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

                var document = htmlWeb.Load(string.Format("{0}://{1}", protocol, domain));

                if (statusCode == HttpStatusCode.NotFound && protocol != "http")
                    return Description(domain, "http");

                if (statusCode != HttpStatusCode.OK)
                    return Content(null);

                var metaTags = document.DocumentNode.SelectNodes("//meta");
                if (metaTags != null) {
                    foreach (var tag in metaTags) {
                        if (tag.Attributes["name"] != null
                            && tag.Attributes["content"] != null
                            && tag.Attributes["name"].Value == "description") {
                            return Content(tag.Attributes["content"].Value);
                        }
                    }
                }

                var titleTag = document.DocumentNode.SelectSingleNode("//title");
                if (titleTag != null) {
                    return Content(titleTag.InnerHtml);
                }
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