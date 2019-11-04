using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
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

            log4net.GlobalContext.Properties["LogDirPath"] = LogMessageRelay.LogDirPath;
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

        public static readonly string IconsDirPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons");
        public static readonly string DescriptionsFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "descriptions.txt");
        public static readonly string LogDirPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");

        public static string[] OldData {
            get {
                var path = LogDirPath;
                var data = new List<string>();

                DirectoryInfo info = new DirectoryInfo(path);
                FileInfo[] files = info.GetFiles().OrderBy(p => p.CreationTime).ToArray();

                foreach (var file in files) {
                    using (FileStream fileStream = new FileStream(
                        file.FullName,
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

        public static Dictionary<string, string> IconsStorage {
            get {
                var icons = new Dictionary<string, string>();

                if (!Directory.Exists(IconsDirPath))
                    return icons;

                DirectoryInfo info = new DirectoryInfo(IconsDirPath);

                foreach (var file in info.GetFiles()) {
                    var contentType = GetMimeType(file.Extension);
                    var domain = Path.GetFileNameWithoutExtension(file.Name);
                    var icon = string.Format("data:{0};base64,{1}", contentType,
                        Convert.ToBase64String(File.ReadAllBytes(file.FullName)));
                    icons.Add(domain, icon);
                }

                return icons;
            }
        }

        public static Dictionary<string, string> DescriptionsStorage = File.Exists(DescriptionsFilePath)
            ? JsonConvert.DeserializeObject<Dictionary<string, string>>(string.Format("{{{0}}}",
                string.Join(",", File.ReadAllLines(DescriptionsFilePath).Where(x => !string.IsNullOrEmpty(x)))))
            : new Dictionary<string, string>();

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

        public static string[] GetFile(string fileName)
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, fileName);

            if (File.Exists(path)) {
                return File.ReadAllLines(path);
            }

            return new string[] { };
        }

        public static void StoreIcon(string domain, string contentType, byte[] data)
        {
            Directory.CreateDirectory(IconsDirPath);
            var fileName = string.Format("{0}{1}", domain, GetExtension(contentType));
            fileName = Path.Combine(IconsDirPath, fileName);
            if (File.Exists(fileName)) {
                if (File.ReadAllBytes(fileName).SequenceEqual(data))
                    return;
            }
            File.WriteAllBytes(fileName, data);
        }

        public static void StoreDescription(string domain, string description)
        {
            StoreValue(domain, description, DescriptionsStorage, DescriptionsFilePath);
        }

        private static void StoreValue(string key, string value, Dictionary<string, string> storage, string filePath)
        {
            try
            {
                lock (storage)
                {
                    if (storage.ContainsKey(key))
                    {
                        if (storage[key].GetHashCode() != value.GetHashCode())
                        {
                            storage[key] = value;

                            File.WriteAllText(filePath, StripBrackets(JsonConvert.SerializeObject(storage)));
                        }

                        return;
                    }

                    storage.Add(key, value);

                    var json = GetLine(new Dictionary<string, string> { { key, value } });
                    File.AppendAllText(filePath, json);
                }
            }
            catch (Exception) { }
        }

        private static string GetLine(object data)
        {
            var json = JsonConvert.SerializeObject(data);
            json = StripBrackets(json);
            return json + Environment.NewLine;
        }

        private static string StripBrackets(string json)
        {
            json = json.Substring(1); // remove {
            json = json.Substring(0, json.Length - 1); // remove }
            json = json.Trim();
            return json;
        }

        private static string GetExtension(string contentType)
        {
            try
            {
                return MimeTypeMap.List.MimeTypeMap.GetExtension(contentType).First();
            } catch (Exception)
            {
                return ".ico";
            }
        }

        private static string GetMimeType(string extension)
        {
            try
            {
                return MimeTypeMap.List.MimeTypeMap.GetMimeType(extension).First();
            }
            catch (Exception)
            {
                return "application/octet-stream";
            }
        }
    }
}