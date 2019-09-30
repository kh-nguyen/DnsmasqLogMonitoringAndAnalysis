﻿using HtmlAgilityPack;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Net;

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
            }
            catch (Exception) { }

            return Content(null);
        }
    }
}