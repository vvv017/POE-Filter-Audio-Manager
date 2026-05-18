using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace POEFilterAudioManager
{
    internal static class Program
    {
        private static Process server;

        private static int Main()
        {
            try
            {
                return Run();
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error.GetType().FullName);
                Console.Error.WriteLine(error.Message);
                Console.Error.WriteLine(error.StackTrace);
                return 1;
            }
        }

        private static int Run()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var appDir = Path.Combine(baseDir, "app");
            var nodePath = Path.Combine(baseDir, "runtime", "node.exe");
            var serverPath = Path.Combine(appDir, "server.js");

            if (!File.Exists(nodePath))
            {
                Console.Error.WriteLine("Missing Node runtime: " + nodePath);
                return 1;
            }

            if (!File.Exists(serverPath))
            {
                Console.Error.WriteLine("Missing app server: " + serverPath);
                return 1;
            }

            var port = FindFreePort(5173, 5199);
            var url = "http://localhost:" + port + "/";

            server = new Process();
            server.StartInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + serverPath + "\" --port=" + port,
                WorkingDirectory = appDir,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs eventArgs)
            {
                eventArgs.Cancel = true;
                StopServer();
                Environment.Exit(0);
            };

            AppDomain.CurrentDomain.ProcessExit += delegate { StopServer(); };

            server.Start();
            Console.WriteLine("POE Filter Audio Manager is starting...");
            Console.WriteLine("URL: " + url);
            Console.WriteLine("Keep this window open while using the app. Press Q or Ctrl+C to stop.");

            var noBrowser = Environment.GetEnvironmentVariable("POE_MANAGER_NO_BROWSER") == "1";
            var selfTest = Environment.GetEnvironmentVariable("POE_MANAGER_SELF_TEST") == "1";

            if (WaitForServer(url, TimeSpan.FromSeconds(10)))
            {
                if (selfTest)
                {
                    Console.WriteLine("Self-test passed.");
                    StopServer();
                    return 0;
                }

                if (!noBrowser)
                {
                    OpenAppWindow(url);
                }
            }
            else
            {
                Console.Error.WriteLine("The local server did not respond in time. The browser was not opened automatically.");
            }

            while (!server.HasExited)
            {
                if (Console.KeyAvailable && Console.ReadKey(true).Key == ConsoleKey.Q)
                {
                    StopServer();
                    break;
                }

                Thread.Sleep(200);
            }

            return 0;
        }

        private static int FindFreePort(int start, int end)
        {
            for (var port = start; port <= end; port++)
            {
                TcpListener listener = null;
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, port);
                    listener.Start();
                    return port;
                }
                catch (SocketException)
                {
                }
                finally
                {
                    if (listener != null) listener.Stop();
                }
            }

            throw new InvalidOperationException("No free port found from " + start + " to " + end + ".");
        }

        private static void OpenAppWindow(string url)
        {
            var browser = FindAppModeBrowser();
            if (!string.IsNullOrEmpty(browser))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = browser,
                    Arguments = "--app=\"" + url + "\" --new-window",
                    UseShellExecute = false
                });
                return;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }

        private static string FindAppModeBrowser()
        {
            var candidates = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (var candidate in candidates)
            {
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static void StopServer()
        {
            try
            {
                if (server != null && !server.HasExited)
                {
                    server.Kill();
                    server.WaitForExit(3000);
                }
            }
            catch
            {
            }
        }

        private static bool WaitForServer(string url, TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow + timeout;

            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create(url);
                    request.Timeout = 1000;
                    request.Method = "GET";
                    using (var response = (HttpWebResponse)request.GetResponse())
                    {
                        if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 500)
                        {
                            return true;
                        }
                    }
                }
                catch
                {
                }

                Thread.Sleep(250);
            }

            return false;
        }
    }
}
