using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace DnsmasqLogMonitoringAndAnalysis
{
    public class Startup
    {
        public static string NETWORK_PORT = Environment.GetEnvironmentVariable("DnsmasqDataPort");

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
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            if (env.IsDevelopment()) {
                app.UseDeveloperExceptionPage();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.UseSignalR(routes => {
                routes.MapHub<DnsmasqQueriesHub>("/dnsmasq");
            });

            app.UseMvc();

            log4net.GlobalContext.Properties["LogFilePath"] = LogMessageRelay.GetLogFilePath();
            loggerFactory.AddLog4Net();

            if (string.IsNullOrEmpty(NETWORK_PORT))
                throw new ArgumentNullException("There is no dnsmasq port in the enviroment variable.");
            app.ApplicationServices.GetService<LogMessageRelay>().Listen(int.Parse(NETWORK_PORT));
        }
    }

    public class DnsmasqQueriesHub : Hub { }

    public class LogMessageRelay
    {
        private readonly IHubContext<DnsmasqQueriesHub> hubContext;

        public static string GetLogFilePath()
        {
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
        }

        public static string[] OldData {
            get {
                var path = GetLogFilePath();
                var data = new List<string>();

                foreach(var file in Directory.EnumerateFiles(path, "log*.txt").OrderBy(x => x)) {
                    using (FileStream fileStream = new FileStream(
                        file,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.ReadWrite)) {
                        using (StreamReader streamReader = new StreamReader(fileStream)) {
                            data.AddRange(streamReader.ReadToEnd().Split(Environment.NewLine));
                        }
                    }
                }

                return data.ToArray();
            }
        }

        public LogMessageRelay(IHubContext<DnsmasqQueriesHub> hubContext)
        {
            this.hubContext = hubContext;
        }

        public void Listen(int port)
        {
            Task.Factory.StartNew(() => {
                while (true) {
                    try {
                        using (var client = new UdpClient(port)) {
                            var sender = new IPEndPoint(IPAddress.Any, 0);

                            while (true) {
                                var buffer = client.Receive(ref sender);

                                // Client is set to null when the UdpClient is disposed
                                // client.Receive will return an empty byte[] when the connection is closed.
                                if (buffer.Length == 0 && client.Client == null)
                                    return;

                                var stringLoggingEvent = System.Text.Encoding.Default.GetString(buffer);

                                using (StringReader reader = new StringReader(stringLoggingEvent)) {
                                    string line = string.Empty;

                                    while ((line = reader.ReadLine()) != null) {
                                        hubContext.Clients.All.SendAsync("loggedEvent", line);

                                        log4net.LogManager.GetLogger(System.Reflection
                                            .MethodBase.GetCurrentMethod().DeclaringType)
                                            .Info(line);
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception) {
                        Thread.Sleep(1000);
                    }
                }
            });
        }
    }
}