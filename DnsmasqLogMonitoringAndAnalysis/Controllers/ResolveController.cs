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
    }
}