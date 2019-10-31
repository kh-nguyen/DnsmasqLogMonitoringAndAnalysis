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

        public ActionResult Description(string domain, string protocol = "https")
        {
            try {
                HttpStatusCode statusCode = HttpStatusCode.OK;

                var htmlWeb = new HtmlWeb {
                    PostResponse = (request, response) => {
                        if (response != null) {
                            statusCode = response.StatusCode;
                        }
                    }
                };
                var url = string.Format("{0}://{1}", protocol, domain);
                var document = htmlWeb.Load(url);

                if (statusCode == HttpStatusCode.NotFound && protocol != "http")
                    return Description(domain, "http");

                if (statusCode != HttpStatusCode.OK)
                    return Content(null);

                string icon = null;
                string title = null;
                string description = null;

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
                            if (!(icon.StartsWith("http") || icon.StartsWith("//"))) {
                                if (!icon.StartsWith("/"))
                                    icon = "/" + icon;
                                icon = url + icon;
                            }
                            break;
                        }
                    }
                }

                var titleTag = document.DocumentNode.SelectSingleNode("//title");
                if (titleTag != null) {
                    title = titleTag.InnerHtml;
                }

                return new JsonResult(new {
                    icon,
                    title,
                    description
                });
            }
            catch (Exception) { }

            return Content(null);
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