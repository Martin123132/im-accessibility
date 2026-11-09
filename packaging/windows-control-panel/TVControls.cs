// I'm Accessibility - minimal owner TV control panel.
// Windows Forms companion to the existing on-demand Task Scheduler TV service.
// This file does not change the stream, receiver, picture mode, or audio route.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;

namespace ImAccessibilityControls
{
    internal sealed class TvStatus
    {
        internal bool Known;
        internal bool Running;
        internal bool VideoReady;
        internal string Note = "";
    }

    internal sealed class ControlPanel : Form
    {

        private static readonly string AppRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        private readonly string controlScript;
        private readonly Label status = new Label();
        private readonly Label detail = new Label();
        private readonly Button start = new Button();
        private readonly Button stop = new Button();
        private readonly Button refresh = new Button();
        private readonly NotifyIcon tray = new NotifyIcon();
        private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        private bool queryInProgress, actionInProgress, exiting;
        private bool taskKnown, taskRunning;
        private readonly Icon appIcon;

        internal ControlPanel(bool minimized)
        {
            controlScript = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Owner-TV-Control.ps1"));
            Text = "I'm Accessibility - status";
            ClientSize = new Size(425, 310);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            Font = new Font("Segoe UI", 10f);
            ShowInTaskbar = true;

            appIcon = MakeIcon();
            Icon = appIcon;
            var title = new Label();
            title.Text = "I'm Accessibility";
            title.Font = new Font("Segoe UI", 16f, FontStyle.Bold);
            title.Location = new Point(18, 14);
            title.Size = new Size(350, 33);
            Controls.Add(title);

            var subtitle = new Label();
            subtitle.Text = "TV connection controls";
            subtitle.ForeColor = Color.DimGray;
            subtitle.Font = new Font("Segoe UI", 9f);
            subtitle.Location = new Point(20, 47);
            subtitle.Size = new Size(340, 25);
            Controls.Add(subtitle);

            status.Text = "TV session: checking...";
            status.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
            status.Location = new Point(20, 84);
            status.Size = new Size(351, 28);
            Controls.Add(status);

            detail.Text = "Checking the Windows TV service.";
            detail.ForeColor = Color.DimGray;
            detail.Font = new Font("Segoe UI", 9f);
            detail.Location = new Point(20, 118);
            detail.Size = new Size(385, 65);
            Controls.Add(detail);

            start.Text = "&Start TV"; start.AccessibleName = "Start selected TV"; start.TabIndex = 0;
            start.Location = new Point(19, 198);
            start.Size = new Size(108, 35);
            start.Enabled = false;
            start.Click += delegate { RequestControl("Start"); };
            Controls.Add(start);

            stop.Text = "S&top TV"; stop.AccessibleName = "Stop this TV session"; stop.TabIndex = 1;
            stop.Location = new Point(138, 198);
            stop.Size = new Size(108, 35);
            stop.Enabled = false;
            stop.Click += delegate { RequestControl("Stop"); };
            Controls.Add(stop);

            refresh.Text = "&Refresh"; refresh.AccessibleName = "Refresh live TV status"; refresh.TabIndex = 2;
            refresh.Location = new Point(257, 198);
            refresh.Size = new Size(108, 35);
            refresh.Click += delegate { RefreshStatus(); };
            Controls.Add(refresh);

            var findTvs = new Button();
            findTvs.Text = "&Find TVs"; findTvs.AccessibleName = "Find TVs on a selected network"; findTvs.TabIndex = 3;
            findTvs.Location = new Point(19, 245);
            findTvs.Size = new Size(346, 36);
            findTvs.Click += delegate { OpenFinder(); };
            Controls.Add(findTvs);
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open controls", null, delegate { OpenPanel(); });
            menu.Items.Add("Find TVs on Wi-Fi", null, delegate { OpenFinder(); });
            menu.Items.Add("Start TV", null, delegate { RequestControl("Start"); });
            menu.Items.Add("Stop TV", null, delegate { RequestControl("Stop"); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit panel (TV keeps playing)", null, delegate { ExitPanel(); });
            tray.Icon = appIcon;
            tray.Text = "I'm Accessibility - checking";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.DoubleClick += delegate { OpenPanel(); };

            timer.Interval = 12000;
            timer.Tick += delegate { RefreshStatus(); };
            timer.Start();
            Shown += delegate { RefreshStatus(); };
            FormClosing += ClosingPanel;
            if (minimized) WindowState = FormWindowState.Minimized;
        }

        private static Icon MakeIcon()
        {
            // Distinctive IA badge in the tray/taskbar, with no external asset.
            using (var bmp = new Bitmap(32, 32))
            using (Graphics g = Graphics.FromImage(bmp))
            using (var font = new Font("Segoe UI", 12f, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                g.Clear(Color.FromArgb(30, 49, 69));
                TextRenderer.DrawText(g, "IA", font, new Rectangle(1, 1, 30, 30),
                    Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                var icon = Icon.FromHandle(bmp.GetHicon());
                return (Icon)icon.Clone();
            }
        }

        private void ClosingPanel(object sender, FormClosingEventArgs e)
        {
            if (!exiting && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                WindowState = FormWindowState.Minimized;
                return;
            }
            timer.Stop();
            tray.Visible = false;
            tray.Dispose();
            appIcon.Dispose();
        }

        private void ExitPanel()
        {
            exiting = true;
            Close();
        }

        private void OpenFinder()
        {
            if (IsDisposed) return;
            OpenPanel();
            using (var finder = new TvFinderDialog())
                finder.ShowDialog(this);
        }
        private void OpenPanel()
        {
            if (IsDisposed) return;
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void UpdateButtons()
        {
            bool ready = !queryInProgress && !actionInProgress && taskKnown;
            start.Enabled = ready && !taskRunning;
            stop.Enabled = ready && taskRunning;
            refresh.Enabled = !queryInProgress && !actionInProgress;
        }

        private void Ui(Action action)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try { BeginInvoke(action); }
            catch (InvalidOperationException) { }
        }

        private void RefreshStatus()
        {
            if (queryInProgress || actionInProgress || IsDisposed) return;
            queryInProgress = true;
            UpdateButtons();
            ThreadPool.QueueUserWorkItem(delegate
            {
                TvStatus result = GetTvStatus();
                Ui(delegate
                {
                    queryInProgress = false;
                    taskKnown = result.Known;
                    taskRunning = result.Running;
                    if (!result.Known)
                    {
                        status.Text = "TV session: status unavailable";
                        status.ForeColor = Color.DarkOrange;
                        detail.Text = result.Note;
                        Text = "I'm Accessibility - check connection";
                        tray.Text = "I'm Accessibility - check connection";
                    }
                    else if (result.Running)
                    {
                        status.Text = result.VideoReady ? "TV session: ON" : "TV session: CHECK";
                        status.ForeColor = result.VideoReady ? Color.DarkGreen : Color.DarkOrange;
                        detail.Text = result.Note;
                        Text = result.VideoReady ? "I'm Accessibility - TV ON" : "I'm Accessibility - checking video";
                        tray.Text = result.VideoReady ? "I'm Accessibility - TV ON" : "I'm Accessibility - video unconfirmed";
                    }
                    else
                    {
                        status.Text = "TV session: OFF";
                        status.ForeColor = Color.Black;
                        detail.Text = String.IsNullOrWhiteSpace(result.Note)?"Choose Start TV to connect.":result.Note;
                        Text = "I'm Accessibility - TV OFF";
                        tray.Text = "I'm Accessibility - TV OFF";
                    }
                    UpdateButtons();
                });
            });
        }

        private void RequestControl(string action)
        {
            if (IsDisposed || actionInProgress || queryInProgress || !taskKnown) return;
            if (action == "Start" && taskRunning) return;
            if (action == "Stop" && !taskRunning) return;
            if (action == "Stop" && MessageBox.Show(this,
                "End the TV viewing session? This will disconnect the picture.",
                "Stop TV viewing", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
                return;
            if (action == "Start" && MessageBox.Show(this, "Start desktop video on your saved LG TV?",
                "Start TV viewing", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
            actionInProgress = true;
            status.Text = action == "Start" ? "Requesting TV start..." : "Requesting TV stop...";
            detail.Text = "Sending your request to the existing TV controller.";
            UpdateButtons();
            ThreadPool.QueueUserWorkItem(delegate
            {
                string stdout, stderr;
                bool ok = RunOwnerAction(action, out stdout, out stderr);
                Ui(delegate
                {
                    actionInProgress = false;
                    if (!ok) MessageBox.Show(this, "The TV control request failed.\r\n" +
                            Short(!String.IsNullOrWhiteSpace(stderr) ? stderr : stdout, 280),
                            "TV controller", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    UpdateButtons();
                    RefreshStatus();
                });
            });
        }

        private static string Short(string s, int max)
        {
            if (s == null) return "";
            s = s.Trim();
            return s.Length > max ? s.Substring(0, max) : s;
        }

        private bool RunOwnerAction(string action, out string stdout, out string stderr)
        {
            stdout = ""; stderr = "";
            if (!File.Exists(controlScript))
            {
                stderr = "Existing owner TV control script not found.";
                return false;
            }
            try
            {
                string exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                    @"System32\WindowsPowerShell\v1.0\powershell.exe");
                string arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" +
                    controlScript.Replace("\"", "") + "\" -Action " + action;
                var info = new ProcessStartInfo(exe, arguments);
                info.WorkingDirectory = Path.GetDirectoryName(controlScript);
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                info.RedirectStandardOutput = true;
                info.RedirectStandardError = true;
                using (Process process = Process.Start(info))
                {
                    var output = process.StandardOutput.ReadToEndAsync();
                    var errors = process.StandardError.ReadToEndAsync();
                    if (!process.WaitForExit(25000))
                    {
                        try { process.Kill(); } catch { }
                        stderr = "Windows TV control timed out.";
                        return false;
                    }
                    stdout = output.Result;
                    stderr = errors.Result;
                    return process.ExitCode == 0;
                }
            }
            catch (Exception ex)
            {
                stderr = Short(ex.Message, 240);
                return false;
            }
        }

        private TvStatus GetTvStatus()
        {
            var result = new TvStatus();
            try
            {
                string stdout, stderr;
                if (!RunOwnerAction("Status", out stdout, out stderr))
                    throw new Exception(Short(stderr, 200));
                var task = new JavaScriptSerializer().DeserializeObject(stdout) as Dictionary<string, object>;
                result.Known = task != null && Yes(task, "registered");
                result.Running = result.Known && (Convert.ToString(task["state"]) == "Running" || Convert.ToString(task["state"]) == "Queued");
                if (!result.Known) { result.Note = "This installation has no verified TV task."; return result; }
                var info = new ProcessStartInfo(Path.Combine(AppRoot, "Runtime", "node.exe"),
                    "\"" + Path.Combine(AppRoot, "status-session.cjs") + "\"");
                info.UseShellExecute = false; info.CreateNoWindow = true;
                info.RedirectStandardOutput = true; info.RedirectStandardError = true;
                using (var process = Process.Start(info))
                {
                    var output = process.StandardOutput.ReadToEndAsync();
                    var error = process.StandardError.ReadToEndAsync();
                    if (!process.WaitForExit(8000)) { process.Kill(); process.WaitForExit(2000); throw new Exception("Video status timed out."); }
                    if (process.ExitCode != 0) throw new Exception(Short(error.Result, 200));
                    var data = new JavaScriptSerializer().DeserializeObject(output.Result) as Dictionary<string, object>;
                    result.VideoReady = data != null && Yes(data, "receiverConfirmed");
                    result.Note = data != null && data.ContainsKey("message") ? Convert.ToString(data["message"]) : "Video status unavailable.";
                }
            }
            catch (Exception ex)
            {
                result.Note = "TV status: " + Short(ex.Message, 200);
            }
            return result;
        }

        private static bool Yes(Dictionary<string, object> j, string key)
        {
            return j.ContainsKey(key) && j[key] is bool && (bool)j[key];
        }
    }

    internal static class Program
    {
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);

        private static void ActivateExisting()
        {
            try
            {
                string current = Path.GetFullPath(Process.GetCurrentProcess().MainModule.FileName);
                foreach (Process other in Process.GetProcesses())
                {
                    try
                    {
                        if (other.Id == Process.GetCurrentProcess().Id ||
                            other.MainWindowHandle == IntPtr.Zero) continue;
                        if (!String.Equals(Path.GetFullPath(other.MainModule.FileName), current,
                            StringComparison.OrdinalIgnoreCase)) continue;
                        ShowWindow(other.MainWindowHandle, 9);
                        SetForegroundWindow(other.MainWindowHandle);
                        return;
                    }
                    catch { }
                    finally { other.Dispose(); }
                }
            }
            catch { }
        }
        [STAThread]
        private static void Main(string[] args)
        {
            bool first;
            using (var mutex = new Mutex(true, @"Local\ImAccessibility_TV_Control_Panel_01", out first))
            {
                if (!first) { ActivateExisting(); return; }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                bool minimized = args != null && Array.Exists(args,
                    delegate(string a) { return String.Equals(a, "--minimized", StringComparison.OrdinalIgnoreCase); });
                Application.Run(new ControlPanel(minimized));
            }
        }
    }
}
