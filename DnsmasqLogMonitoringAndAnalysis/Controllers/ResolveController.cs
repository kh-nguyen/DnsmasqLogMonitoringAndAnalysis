using HtmlAgilityPack;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Net;
using System.Text;

namespace DnsmasqLogMonitoringAndAnalysis.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class ResolveController : ControllerBase
    {
        [HttpPost("{ipAddress}")]
        public ActionResult Hostname(string ipAddress)
        {
            string hostname = null;

            try
            {
                IPAddress hostIPAddress = IPAddress.Parse(ipAddress);
                hostname = Dns.GetHostEntry(hostIPAddress).HostName;
            }
            catch (Exception) { }

            return Content(string.IsNullOrEmpty(hostname) ? ipAddress : hostname);
        }

        public ActionResult Description([FromQuery] DescriptionRequest descriptionRequest)
        {
            try {
                ServicePointManager.SecurityProtocol
                    = SecurityProtocolType.Tls
                    | SecurityProtocolType.Tls11
                    | SecurityProtocolType.Tls12;

                ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

                HttpStatusCode statusCode = HttpStatusCode.OK;
                HtmlDocument document = new HtmlDocument();

                if (string.IsNullOrEmpty(descriptionRequest.ipAddress)) {
                    var htmlWeb = new HtmlWeb {
                        PostResponse = (request, response) => {
                            if (response != null) {
                                statusCode = response.StatusCode;
                            }
                        }
                    };
                    descriptionRequest.url = string.Format("{0}://{1}", descriptionRequest.protocol, descriptionRequest.domain);
                    document = htmlWeb.Load(descriptionRequest.url);
                } else {
                    descriptionRequest.url = string.Format("{0}://{1}", descriptionRequest.protocol, descriptionRequest.ipAddress);
                    var request = (HttpWebRequest)WebRequest.Create(descriptionRequest.url);
                    request.Host = descriptionRequest.domain;
                    try {
                        using (var response = (HttpWebResponse)request.GetResponse()) {
                            statusCode = response.StatusCode;

                            if (statusCode == HttpStatusCode.OK) {
                                var encoding = Encoding.GetEncoding(response.CharacterSet);

                                using (var responseStream = response.GetResponseStream())
                                using (var reader = new StreamReader(responseStream, encoding))
                                    document.LoadHtml(reader.ReadToEnd());
                            }
                        }
                    }
                    catch (WebException we) {
                        statusCode = ((HttpWebResponse)we.Response).StatusCode;
                    }
                }

                if (statusCode == HttpStatusCode.NotFound && descriptionRequest.protocol != "http") {
                    descriptionRequest.protocol = "http";
                    return Description(descriptionRequest);
                }

                if (statusCode != HttpStatusCode.OK)
                    return Content(null);

                return Description(document, descriptionRequest);
            }
            catch (Exception) { }

            return Content(null);
        }

        private ActionResult Description(HtmlDocument document, DescriptionRequest descriptionRequest)
        {
            string icon = null;
            string title = null;
            string description = null;

            if (document == null || string.IsNullOrEmpty(descriptionRequest.url))
                return Content(null);

            var metaTags = document.DocumentNode.SelectNodes("//meta");
            if (metaTags != null) {
                foreach (var tag in metaTags) {
                    var name = tag.Attributes["name"];
                    var content = tag.Attributes["content"];
                    if (name != null && name.Value == "description" && content != null) {
                        description = content.Value;
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
                        icon = href.Value;
                        if (!icon.StartsWith("data:")) {
                            if (icon.StartsWith("//"))
                                icon = descriptionRequest.protocol + ":" + icon;
                            else if (icon.StartsWith("/"))
                                icon = descriptionRequest.GetBaseUrl() + icon;
                            else if (!icon.StartsWith("http"))
                                icon = descriptionRequest.GetBaseUrl() + "/" + icon;
                            icon = DownloadIcon(new Uri(icon), descriptionRequest);
                        }
                        break;
                    }
                }
            }

            var titleTag = document.DocumentNode.SelectSingleNode("//title");
            if (titleTag != null) {
                title = titleTag.InnerHtml;
            }

            // download the icon from the default location if the icon
            // cannot be retrieved from the document
            if (icon == null) {
                icon = DownloadIcon(new Uri(string.Format("{0}://{1}/favicon.ico",
                    descriptionRequest.protocol, descriptionRequest.domain)), descriptionRequest);
            }

            if (!string.IsNullOrEmpty(description)) {
                LogMessageRelay.StoreDescription(descriptionRequest.domain, description);
            }

            string bodyText = document.DocumentNode.SelectSingleNode("//body").ToPlainText();

            return new JsonResult(new {
                icon,
                title,
                description,
                bodyText
            });
        }

        private string DownloadIcon(Uri url, DescriptionRequest descriptionRequest)
        {
            if (url.Host == descriptionRequest.domain)
                url = new UriBuilder(url) { Host = descriptionRequest.ipAddress }.Uri;

            var request = (HttpWebRequest)WebRequest.Create(url);

            // note: if the url contains the hostname then it may leak DNS requests from the web server
            if (request.Host.Split(".").Length == 4) // check if it is an IP
                request.Host = descriptionRequest.domain;

            try {
                using (var response = (HttpWebResponse)request.GetResponse()) {
                    if (response.StatusCode == HttpStatusCode.OK) {
                        if (string.IsNullOrEmpty(response.ContentType) || !response.ContentType.StartsWith("image"))
                            return null;

                        using (var ms = new MemoryStream())
                        using (var responseStream = response.GetResponseStream()) {
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
                }
            }
            catch (WebException) { }

            return null;
        }

        public ActionResult Vendor(string mac)
        {
            if (string.IsNullOrEmpty(mac))
                return Content(null);

            try {
                using (var client = new WebClient())
                using (var stream = client.OpenRead(string.Format("https://api.macvendors.com/{0}", mac)))
                using (var textReader = new StreamReader(stream, Encoding.UTF8, true)) {
                    var vendor = textReader.ReadToEnd();
                    LogMessageRelay.StoreVendor(mac, vendor);
                    return Content(vendor);
                }
            }
            catch (Exception) { }

            return Content(null);
        }

        public ActionResult Data()
        {
            return new JsonResult(LogMessageRelay.OldData);
        }
    }

    public class DescriptionRequest
    {
        public string domain { get; set; }
        public string ipAddress { get; set; }
        public string protocol { get; set; } = "https";
        public string url { get; set; }

        public string GetBaseUrl() {
            return new Uri(url).GetLeftPart(UriPartial.Authority);
        }
    }
}