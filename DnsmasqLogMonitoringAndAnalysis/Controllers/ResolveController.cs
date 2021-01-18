using HtmlAgilityPack;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace DnsmasqLogMonitoringAndAnalysis.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class ResolveController : ControllerBase
    {
        private readonly LogMessageRelay logMessageRelay;

        public ResolveController(LogMessageRelay logMessageRelay)
        {
            this.logMessageRelay = logMessageRelay;
        }

        [HttpGet("{ipAddress}")]
        public async Task<ActionResult> Hostname(string ipAddress)
        {
            string hostname = null;

            try {
                IPAddress hostIPAddress = IPAddress.Parse(ipAddress);
                hostname = (await Dns.GetHostEntryAsync(hostIPAddress)).HostName;

                if (!string.IsNullOrEmpty(hostname) && hostname != ipAddress) {
                    LogMessageRelay.StoreHostname(ipAddress, hostname);
                }
            }
            catch (Exception ex) {
                logMessageRelay.SendMessage($"{ipAddress} => {ex.Message}");
            }

            return Content(string.IsNullOrEmpty(hostname) ? ipAddress : hostname);
        }

        [HttpPost("{ipAddress}")]
        public void Hostname(string ipAddress, [FromForm] string hostname)
        {
            LogMessageRelay.StoreHostname(ipAddress, hostname);
        }

        public async Task<ActionResult> Description([FromQuery] DescriptionRequest descriptionRequest)
        {
            try {
                // if there is no IP address info in the request, then returns
                // the description stored in the database if there is one
                if (string.IsNullOrEmpty(descriptionRequest.ipAddress)) {
                    var www = $"www.{descriptionRequest.domain}";

                    LogMessageRelay.DescriptionsStorage.TryGetValue(descriptionRequest.domain, out string description);

                    if (string.IsNullOrEmpty(description) && !descriptionRequest.domain.StartsWith("www."))
                        LogMessageRelay.DescriptionsStorage.TryGetValue(www, out description);

                    return new JsonResult(new Description {
                        icon = LogMessageRelay.GetIcon(descriptionRequest.domain) ?? LogMessageRelay.GetIcon(www),
                        description = description
                    });
                }

                ServicePointManager.SecurityProtocol
                    = SecurityProtocolType.Tls
                    | SecurityProtocolType.Tls11
                    | SecurityProtocolType.Tls12;

                ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

                return await Description(new Uri(descriptionRequest.url), descriptionRequest);
            }
            catch (Exception ex) {
                logMessageRelay.SendMessage($"{descriptionRequest.domain} => {ex.Message}");
            }

            return Content(null);
        }

        private HttpWebRequest GetHttpWebRequest(Uri uri, DescriptionRequest descriptionRequest)
        {
            bool hasIpAddress = uri.Host == descriptionRequest.domain;

            // Note: may leak DNS requests if the domain name in the
            // uri is not the same in the descriptionRequest
            if (hasIpAddress)
                uri = new UriBuilder(uri) { Host = descriptionRequest.ipAddress }.Uri;

            var request = (HttpWebRequest)WebRequest.Create(uri);
            request.CookieContainer = new CookieContainer();
            request.ContentType = "text/html; charset=utf-8";
            request.Accept = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3";
            request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36";

            if (hasIpAddress)
                request.Host = descriptionRequest.domain;

            return request;
        }

        private async Task<ActionResult> Description(Uri uri, DescriptionRequest descriptionRequest)
        {
            HttpStatusCode statusCode = HttpStatusCode.Unused;
            HtmlDocument document = new HtmlDocument();

            var request = GetHttpWebRequest(uri, descriptionRequest);

            try {
                using var response = (HttpWebResponse)await request.GetResponseAsync();

                statusCode = response.StatusCode;

                if (statusCode == HttpStatusCode.OK) {
                    var encoding = GetEncoding(response);
                    using var responseStream = response.GetResponseStream();
                    using var reader = new StreamReader(responseStream, encoding);
                    document.LoadHtml(reader.ReadToEnd());
                }
            }
            catch (WebException we) {
                logMessageRelay.SendMessage($"{descriptionRequest.domain} => {we.Message}");

                if (we.Response == null)
                    throw;

                var redirectUrl = GetRedirectUrl(we);

                if (!string.IsNullOrEmpty(redirectUrl))
                    return await Description(new Uri(redirectUrl), descriptionRequest);
            }

            if (statusCode == HttpStatusCode.NotFound && descriptionRequest.protocol != "http") {
                descriptionRequest.SetProtocol("http");
                return await Description(descriptionRequest);
            }

            if (statusCode != HttpStatusCode.OK)
                return Content(null);

            return await Description(document, descriptionRequest);
        }

        private string GetRedirectUrl(WebException we)
        {
            var response = ((HttpWebResponse)we.Response);
            var statusCode = response.StatusCode;

            // handle web redirect where the redirected url is stored in the headers
            if ((int)statusCode >= 300 && (int)statusCode <= 399) {
                var strLocation = response.Headers["Location"];

                if (string.IsNullOrEmpty(strLocation))
                    throw we;

                return strLocation;
            }

            return null;
        }

        private Encoding GetEncoding(HttpWebResponse response)
        {
            try {
                return Encoding.GetEncoding(response.CharacterSet);
            }
            catch (Exception) { }

            return Encoding.UTF8;
        }

        private async Task<ActionResult> Description(HtmlDocument document, DescriptionRequest descriptionRequest)
        {
            var result = new Description();

            if (document == null || string.IsNullOrEmpty(descriptionRequest.url))
                return Content(null);

            var metaTags = document.DocumentNode.SelectNodes("//meta");
            if (metaTags != null) {
                foreach (var tag in metaTags) {
                    var name = tag.Attributes["name"];
                    var content = tag.Attributes["content"];
                    if (name != null && name.Value == "description" && content != null) {
                        result.description = content.Value;
                        break;
                    }
                }
            }

            var linkTags = document.DocumentNode.SelectNodes("//link");
            if (linkTags != null) {
                foreach (var tag in linkTags) {
                    var rel = tag.Attributes["rel"];
                    var href = tag.Attributes["href"];
                    if (rel != null && rel.Value.Contains("icon") && href != null) {
                        result.icon = href.Value;
                        if (!result.icon.StartsWith("data:")) {
                            if (result.icon.StartsWith("//"))
                                result.icon = descriptionRequest.protocol + ":" + result.icon;
                            else if (result.icon.StartsWith("/"))
                                result.icon = descriptionRequest.GetBaseUrl() + result.icon;
                            else if (!result.icon.StartsWith("http"))
                                result.icon = descriptionRequest.GetBaseUrl() + "/" + result.icon;
                            result.icon = await DownloadIcon(new Uri(result.icon), descriptionRequest);
                        }
                        break;
                    }
                }
            }

            var titleTag = document.DocumentNode.SelectSingleNode("//title");
            if (titleTag != null) {
                result.title = titleTag.InnerHtml;
            }

            // download the icon from the default location if the icon
            // cannot be retrieved from the document
            if (result.icon == null) {
                result.icon = await DownloadIcon(new Uri(string.Format("{0}://{1}/favicon.ico",
                    descriptionRequest.protocol, descriptionRequest.domain)), descriptionRequest);
            }

            if (!string.IsNullOrEmpty(result.description)) {
                LogMessageRelay.StoreDescription(descriptionRequest.domain, result.description);
            }

            result.bodyText = document.DocumentNode.SelectSingleNode("//body").ToPlainText();

            return new JsonResult(result);
        }

        private async Task<string> DownloadIcon(Uri uri, DescriptionRequest descriptionRequest)
        {
            var request = GetHttpWebRequest(uri, descriptionRequest);

            try {
                using var response = (HttpWebResponse)await request.GetResponseAsync();

                if (response.StatusCode == HttpStatusCode.OK) {
                    if (string.IsNullOrEmpty(response.ContentType) || !response.ContentType.StartsWith("image"))
                        return null;

                    using var ms = new MemoryStream();
                    using var responseStream = response.GetResponseStream();
                    responseStream.CopyTo(ms);

                    if (ms.Length > 1) {
                        var bytes = ms.ToArray();
                        LogMessageRelay.StoreIcon(descriptionRequest.domain, response.ContentType, bytes);
                        var icon = string.Format("data:{0};base64,{1}",
                            response.ContentType, Convert.ToBase64String(bytes));
                        return icon;
                    }
                }
            }
            catch (WebException we) {
                logMessageRelay.SendMessage($"{uri} => {we.Message}");

                if (we.Response == null)
                    throw;

                var redirectUrl = GetRedirectUrl(we);

                if (!string.IsNullOrEmpty(redirectUrl)) {
                    return await DownloadIcon(new Uri(redirectUrl), descriptionRequest);
                }
            }

            return null;
        }

        public async Task<ActionResult> Vendor(string mac)
        {
            if (string.IsNullOrEmpty(mac))
                return Content(null);

            try {
                using var client = new WebClient();
                using var stream = client.OpenRead(string.Format("https://api.macvendors.com/{0}", mac));
                using var textReader = new StreamReader(stream, Encoding.UTF8, true);
                var vendor = await textReader.ReadToEndAsync();
                LogMessageRelay.StoreVendor(mac, vendor);
                return Content(vendor);
            }
            catch (Exception ex) {
                logMessageRelay.SendMessage($"{mac} => {ex.Message}");
            }

            return Content(null);
        }

        public async Task Data(DateTime? fromDate, string fileName)
        {
            Response.ContentType = "text/plain";

            var files = LogMessageRelay.GetLogFiles(fromDate);

            if (!string.IsNullOrEmpty(fileName))
                files = files.Where(x => x.Name == fileName);

            foreach (var file in files) {
                using FileStream fileStream = new FileStream(
                    file.FullName,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite);
                await fileStream.CopyToAsync(Response.Body);
                await Response.Body.FlushAsync();
            }

            Response.StatusCode = StatusCodes.Status200OK;
        }

        public ActionResult GetIcons()
        {
            return Ok(LogMessageRelay.IconsStorage);
        }

        public ActionResult GetDescriptions()
        {
            return Ok(LogMessageRelay.DescriptionsStorage);
        }

        public ActionResult LogFiles(DateTime? fromDate)
        {
            return Ok(LogMessageRelay.GetLogFiles(fromDate).Select(x => new {
                x.Name,
                x.Length
            }));
        }
    }

    public class DescriptionRequest
    {
        public string domain { get; set; }
        public string ipAddress { get; set; }
        public string protocol { get; private set; } = "https";
        public string path { get; set; }
        public string url { get { return $"{protocol}://{domain}{path}";  } }

        public void SetProtocol(string protocol)
        {
            this.protocol = protocol;
        }

        public string GetBaseUrl()
        {
            return new Uri(url).GetLeftPart(UriPartial.Authority);
        }
    }

    public class Description
    {
        public string icon { get; set; }
        public string title { get; set; }
        public string description { get; set; }
        public string bodyText { get; set; }
    }
}