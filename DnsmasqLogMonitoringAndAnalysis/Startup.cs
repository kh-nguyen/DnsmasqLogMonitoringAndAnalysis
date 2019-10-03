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

            log4net.GlobalContext.Properties["LogFileName"] = LogMessageRelay.GetLogFilePath();
            loggerFactory.AddLog4Net();

            var listernPort = Environment.GetEnvironmentVariable("DnsmasqDataPort");
            if (string.IsNullOrEmpty(listernPort))
                throw new ArgumentNullException("There is no dnsmasq port in the enviroment variable.");
            app.ApplicationServices.GetService<LogMessageRelay>().Listen(int.Parse(listernPort));
        }
    }

    public class DnsmasqQueriesHub : Hub { }

    public class LogMessageRelay
    {
        public const string LOG_FILE_NAME = "log.txt";

        private readonly IHubContext<DnsmasqQueriesHub> hubContext;

        public static string GetLogFilePath()
        {
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, LOG_FILE_NAME);
        }

        public static string[] OldData {
            get {
                var path = GetLogFilePath();

                if (File.Exists(path)) {
                    using (FileStream fileStream = new FileStream(
                        path,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.ReadWrite)) {
                        using (StreamReader streamReader = new StreamReader(fileStream)) {
                            return streamReader.ReadToEnd().Split(Environment.NewLine);
                        }
                    }
                }

                return null;
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