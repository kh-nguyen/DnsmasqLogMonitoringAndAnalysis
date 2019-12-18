using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace DnsmasqLogMonitoringAndAnalysis
{
    public class Startup
    {
        public static int NetworkPort = 514; // default listen port

        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

            services.AddRazorPages();

            services.AddControllers().AddNewtonsoftJson();

            services.AddSignalR();

            services.AddSingleton<LogMessageRelay>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
        {
            if (env.IsDevelopment()) {
                app.UseDeveloperExceptionPage();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseRouting();

            app.UseAuthorization();

            app.UseEndpoints(endpoints => {
                endpoints.MapHub<DnsmasqQueriesHub>("/dnsmasq");
                endpoints.MapDefaultControllerRoute();
                endpoints.MapRazorPages();
            });

            log4net.GlobalContext.Properties["LogDirPath"] = LogMessageRelay.LogDirPath;
            loggerFactory.AddLog4Net();

            var networkPortPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "port.txt");
            if (File.Exists(networkPortPath))
                int.TryParse(File.ReadAllText(networkPortPath), out NetworkPort);
            app.ApplicationServices.GetService<LogMessageRelay>().Listen(NetworkPort);
        }
    }

    public class DnsmasqQueriesHub : Hub { }

    public class LogMessageRelay
    {
        private readonly IHubContext<DnsmasqQueriesHub> hubContext;

        public static readonly string IconsDirPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons");
        public static readonly string DescriptionsFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "descriptions.txt");
        public static readonly string VendorsFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "vendors.txt");
        public static readonly string HostnamesFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "hostnames.txt");
        public static readonly string LogDirPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");

        public static string[] OldData(DateTime? fromDate = null)
        {
            var data = new List<string>();
            var files = GetLogFiles(fromDate);

            foreach (var file in files) {
                using FileStream fileStream = new FileStream(
                    file.FullName,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite);
                using StreamReader streamReader = new StreamReader(fileStream);
                while (!streamReader.EndOfStream) {
                    data.Add(streamReader.ReadLine());
                }
            }

            return data.ToArray();
        }

        public static readonly Dictionary<string, string> IconsStorage = GetIcons();

        public static Dictionary<string, string> DescriptionsStorage
            = GetStorage<Dictionary<string, string>>(DescriptionsFilePath)
            // if there is no icon associated, then a new description request will be
            // made each time there is a new DNS query for the particular domain
            .Where(x => IconsStorage.ContainsKey(x.Key))
            .ToDictionary(x => x.Key, y => y.Value);

        public static Dictionary<string, string> VendorsStorage
            = GetStorage<Dictionary<string, string>>(VendorsFilePath);

        public static Dictionary<string, string> HostnamesStorage
            = GetStorage<Dictionary<string, string>>(HostnamesFilePath);

        public LogMessageRelay(IHubContext<DnsmasqQueriesHub> hubContext)
        {
            this.hubContext = hubContext;
        }

        public void Listen(int port)
        {
            Task.Factory.StartNew(() => {
                while (true) {
                    try {
                        using var client = new UdpClient(port);
                        var sender = new IPEndPoint(IPAddress.Any, 0);

                        while (true) {
                            var buffer = client.Receive(ref sender);

                            // Client is set to null when the UdpClient is disposed
                            // client.Receive will return an empty byte[] when the connection is closed.
                            if (buffer.Length == 0 && client.Client == null)
                                return;

                            var stringLoggingEvent = Encoding.Default.GetString(buffer);
                            using StringReader reader = new StringReader(stringLoggingEvent);
                            string line = string.Empty;

                            while ((line = reader.ReadLine()) != null) {
                                SendMessage(line);

                                log4net.LogManager.GetLogger(System.Reflection
                                    .MethodBase.GetCurrentMethod().DeclaringType)
                                    .Info(line);
                            }
                        }
                    }
                    catch (Exception) {
                        Thread.Sleep(1000);
                    }
                }
            });
        }

        public void SendMessage(string message)
        {
            hubContext.Clients.All.SendAsync("loggedEvent", message);
        }

        public static IEnumerable<FileInfo> GetLogFiles(DateTime? fromDate = null)
        {
            var path = LogDirPath;

            DirectoryInfo info = new DirectoryInfo(path);

            return info.GetFiles()
                .Where(x => x.LastWriteTime >= (fromDate ?? DateTime.MinValue))
                .OrderBy(p => p.LastWriteTime);
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
            var extension = GetExtension(contentType);
            var fileName = Path.Combine(IconsDirPath, string.Format("{0}{1}", domain, extension));
            if (File.Exists(fileName)) {
                if (File.ReadAllBytes(fileName).SequenceEqual(data))
                    return;
            }
            else {
                var sameNames = Directory.EnumerateFiles(IconsDirPath, $"{domain}.*")
                    .Where(x => Path.GetFileNameWithoutExtension(x) == domain);

                // remove domains with different file extensions if any
                if (sameNames.Any()) {
                    foreach (var file in sameNames)
                        File.Delete(file);
                }
            }
            File.WriteAllBytes(fileName, data);
        }

        public static void StoreDescription(string domain, string description)
        {
            // remove the {{ and }} to avoid in conflict with AngularJS
            description = description.Replace("{{", "[[").Replace("}}", "]]");
            StoreValue(domain, description, DescriptionsStorage, DescriptionsFilePath);
        }

        public static void StoreVendor(string mac, string description)
        {
            StoreValue(mac, description, VendorsStorage, VendorsFilePath);
        }

        public static void StoreHostname(string ipAddress, string hostname)
        {
            StoreValue(ipAddress, hostname, HostnamesStorage, HostnamesFilePath);
        }

        private static void StoreValue(string key, string value, Dictionary<string, string> storage, string filePath)
        {
            try {
                lock (storage) {
                    if (storage.ContainsKey(key)) {
                        if (storage[key].GetHashCode() != value.GetHashCode()) {
                            storage[key] = value;

                            File.WriteAllText(filePath, string.Join(string.Empty,
                                storage.Select(x => GetLine(new Dictionary<string, string> { { x.Key, x.Value } }))));
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
            json = json[0..^1]; // remove }
            json = json.Trim();
            return json;
        }

        private static string GetExtension(string contentType)
        {
            try {
                return MimeTypeMap.List.MimeTypeMap.GetExtension(contentType).First();
            }
            catch (Exception) {
                return ".ico";
            }
        }

        private static string GetMimeType(string extension)
        {
            try {
                return MimeTypeMap.List.MimeTypeMap.GetMimeType(extension).First();
            }
            catch (Exception) {
                return "application/octet-stream";
            }
        }

        private static Dictionary<string, string> GetIcons()
        {
            var icons = new Dictionary<string, string>();

            if (!Directory.Exists(IconsDirPath))
                return icons;

            var info = new DirectoryInfo(IconsDirPath);

            // only load files that are not too old
            var files = info.GetFiles();

            foreach (var file in files) {
                var contentType = GetMimeType(file.Extension);
                var domain = Path.GetFileNameWithoutExtension(file.Name);
                var icon = string.Format("data:{0};base64,{1}", contentType,
                    Convert.ToBase64String(File.ReadAllBytes(file.FullName)));
                if (!icons.ContainsKey(domain))
                    icons.Add(domain, icon);
            }

            return icons;
        }

        private static T GetStorage<T>(string filePath)
        {
            return File.Exists(filePath)
                ? JsonConvert.DeserializeObject<T>(string.Format("{{{0}}}",
                    string.Join(",", File.ReadAllLines(filePath).Where(x => !string.IsNullOrEmpty(x)))))
                : (T)Activator.CreateInstance(typeof(T));
        }
    }
}