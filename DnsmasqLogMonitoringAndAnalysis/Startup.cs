using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace DnsmasqLogMonitoringAndAnalysis
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_1);

            services.AddSignalR();

            services.AddSingleton<LogMessageRelay>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.UseSignalR(routes => {
                routes.MapHub<DnsmasqQueriesHub>("/dnsmasq");
            });

            app.UseMvc();

            var listernPort = Environment.GetEnvironmentVariable("DnsmasqDataPort");
            if (string.IsNullOrEmpty(listernPort))
                throw new ArgumentNullException("There is no dnsmasq port in the enviroment variable.");
            app.ApplicationServices.GetService<LogMessageRelay>().Listen(int.Parse(listernPort));
        }
    }

    public class DnsmasqQueriesHub : Hub { }

    public class LogMessageRelay
    {
        private readonly IHubContext<DnsmasqQueriesHub> hubContext;

        public LogMessageRelay(IHubContext<DnsmasqQueriesHub> hubContext)
        {
            this.hubContext = hubContext;
        }

        public void Listen(int port)
        {
            Task.Factory.StartNew(() => {
                while (true)
                {
                    try
                    {
                        using (var client = new UdpClient(port))
                        {
                            var sender = new IPEndPoint(IPAddress.Any, 0);

                            while (true)
                            {
                                var buffer = client.Receive(ref sender);

                                // Client is set to null when the UdpClient is disposed
                                // client.Receive will return an empty byte[] when the connection is closed.
                                if (buffer.Length == 0 && client.Client == null)
                                    return;

                                var stringLoggingEvent = System.Text.Encoding.Default.GetString(buffer);

                                using (StringReader reader = new StringReader(stringLoggingEvent))
                                {
                                    string line = string.Empty;

                                    while ((line = reader.ReadLine()) != null)
                                    {
                                        hubContext.Clients.All.SendAsync("loggedEvent", line);
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception)
                    {
                        Thread.Sleep(1000);
                    }
                }
            });
        }
    }
}
