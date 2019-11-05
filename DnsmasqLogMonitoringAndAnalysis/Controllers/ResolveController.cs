using HtmlAgilityPack;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Linq;
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

        public ActionResult Description(string domain, string ipAddress, string protocol = "https")
        {
            try {
                ServicePointManager.SecurityProtocol
                    = SecurityProtocolType.Tls
                    | SecurityProtocolType.Tls11
                    | SecurityProtocolType.Tls12;

                ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

                HttpStatusCode statusCode = HttpStatusCode.OK;
                HtmlDocument document = new HtmlDocument();
                string url = null;

                if (string.IsNullOrEmpty(ipAddress)) {
                    var htmlWeb = new HtmlWeb {
                        PostResponse = (request, response) => {
                            if (response != null) {
                                statusCode = response.StatusCode;
                            }
                        }
                    };
                    url = string.Format("{0}://{1}", protocol, domain);
                    document = htmlWeb.Load(url);
                } else {
                    url = string.Format("{0}://{1}", protocol, ipAddress);
                    var request = (HttpWebRequest)WebRequest.Create(url);
                    request.Host = domain;
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

                if (statusCode == HttpStatusCode.NotFound && protocol != "http")
                    return Description(domain, ipAddress, "http");

                if (statusCode != HttpStatusCode.OK)
                    return Content(null);

                return Description(document, url, domain);
            }
            catch (Exception) { }

            return Content(null);
        }

        private ActionResult Description(HtmlDocument document, string url, string domain)
        {
            string icon = null;
            string title = null;
            string description = null;

            if (document == null || string.IsNullOrEmpty(url))
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
                                icon = url.Substring(0, url.IndexOf("//")) + icon;
                            else if (icon.StartsWith("/"))
                                icon = url + icon;
                            else if (!icon.StartsWith("http"))
                                icon = url + "/" + icon;
                            icon = DownloadIcon(icon, domain);
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
                icon = DownloadIcon(url + "/favicon.ico", domain);
            }

            if (!string.IsNullOrEmpty(description)) {
                LogMessageRelay.StoreDescription(domain, description);
            }

            string bodyText = document.DocumentNode.SelectSingleNode("//body").ToPlainText();

            return new JsonResult(new {
                icon,
                title,
                description,
                bodyText
            });
        }

        private string DownloadIcon(string url, string domain)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);

            // note: if the url contains the hostname then it may leak DNS requests from the web server
            if (request.Host.Split(".").Length == 4) // check if it is an IP
                request.Host = domain;

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
                                LogMessageRelay.StoreIcon(domain, response.ContentType, bytes);
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
            try {
                using (var client = new WebClient())
                using (var stream = client.OpenRead(string.Format("https://api.macvendors.com/{0}", mac)))
                using (var textReader = new StreamReader(stream, Encoding.UTF8, true)) {
                    var vendor = textReader.ReadToEnd();
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
}