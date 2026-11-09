using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;

namespace ImAccessibilityControls
{
    // Read-only TV finder dialog. No automatic pairing, no saved-TV mutation.
    internal sealed class TvFinderDialog : Form
    {
        private static readonly string Node = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "Runtime", "node.exe"));
        private readonly string Finder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "TVFinder.cjs");
        private readonly ListView tvs=new ListView();
        private readonly Label summary=new Label();
        private readonly Label details=new Label();
        private readonly Button rescan=new Button();
        private readonly Button close=new Button();
        private bool running;
        private readonly ComboBox networks=new ComboBox();
        private sealed class NetworkChoice {
            internal string Name,IP;
            public override string ToString(){return Name+" | "+IP;}
        }
        private static string RunFinder(string operation,string input) {
            if(!File.Exists(Node))throw new Exception("Bundled Node runtime is missing.");
            var si=new ProcessStartInfo(Node,"\""+Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"TVFinder.cjs")+"\" "+operation);
            si.UseShellExecute=false;si.CreateNoWindow=true;
            si.RedirectStandardInput=true;si.RedirectStandardOutput=true;si.RedirectStandardError=true;
            using(var p=Process.Start(si)){
                var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();
                if(input!=null)p.StandardInput.Write(input);p.StandardInput.Close();
                if(!p.WaitForExit(11000)){p.Kill();p.WaitForExit(2000);throw new Exception("Discovery timed out.");}
                if(p.ExitCode!=0)throw new Exception(error.Result.Trim());
                if(output.Result.Length>64000)throw new Exception("Unexpected discovery output size.");
                return output.Result;
            }
        }
        private void LoadNetworks(){
            try{
                var data=new JavaScriptSerializer().DeserializeObject(RunFinder("--networks",null)) as Dictionary<string,object>;
                var selected=data["selected"] as Dictionary<string,object>;
                foreach(var item in (object[])data["adapters"]){
                    var row=item as Dictionary<string,object>;
                    var choice=new NetworkChoice{Name=Field(row,"name"),IP=Field(row,"ip")};
                    networks.Items.Add(choice);
                    if(selected!=null&&choice.Name==Field(selected,"name")&&choice.IP==Field(selected,"ip"))networks.SelectedItem=choice;
                }
                // Even a single new interface must be explicitly selected when a saved network fails.
                summary.Text="Choose the network to search. This does not change your saved TV.";
                if(networks.SelectedItem!=null)Scan();
            }catch(Exception ex){summary.Text="Network list unavailable.";details.Text=ex.Message;}
        }
        internal TvFinderDialog()
        {
            Text="Find TVs on your Wi-Fi";
            ClientSize=new Size(720,410);
            FormBorderStyle=FormBorderStyle.FixedDialog;
            StartPosition=FormStartPosition.CenterParent;
            MaximizeBox=false;MinimizeBox=false;
            Font=new Font("Segoe UI",9.5f);BackColor=Color.White;

            var title=new Label();
            title.Text="Find TVs and casting devices";
            title.Font=new Font("Segoe UI",13f,FontStyle.Bold);
            title.Location=new Point(20,14);title.Size=new Size(660,33);
            Controls.Add(title);

            summary.Location=new Point(20,52);summary.Size=new Size(680,24);
            summary.Text="Searching local Wi-Fi...";summary.ForeColor=Color.DimGray;
            Controls.Add(summary);

            networks.SetBounds(18,80,683,30);networks.DropDownStyle=ComboBoxStyle.DropDownList;
            networks.AccessibleName="Network to search for TVs";networks.TabIndex=0;Controls.Add(networks);
            tvs.TabIndex=1;tvs.AccessibleName="Discovered TVs and support status";
            tvs.Location=new Point(18,120);tvs.Size=new Size(683,197);
            tvs.View=View.Details;tvs.FullRowSelect=true;tvs.GridLines=true;
            tvs.HideSelection=false;tvs.MultiSelect=false;
            tvs.Columns.Add("Device",220);tvs.Columns.Add("Type",120);
            tvs.Columns.Add("IP address",115);tvs.Columns.Add("Connection",197);
            tvs.SelectedIndexChanged+=delegate{Selected();};
            Controls.Add(tvs);

            details.Location=new Point(20,322);details.Size=new Size(676,40);
            details.Text="Your current LG remains selected. Discovering a TV doesn't automatically enable streaming.";
            details.ForeColor=Color.DimGray;Controls.Add(details);

            rescan.Text="Scan again";rescan.Location=new Point(18,365);
            rescan.Size=new Size(125,32);rescan.Click+=delegate{Scan();};Controls.Add(rescan);
            close.Text="Close";close.Location=new Point(576,365);
            close.Size=new Size(125,32);close.Click+=delegate{Close();};Controls.Add(close);
            Shown+=delegate{LoadNetworks();};
        }

        private static string Field(Dictionary<string,object> row,string name)
        {
            object value;
            if(row==null||!row.TryGetValue(name,out value)||value==null)return "";
            string s=Convert.ToString(value);
            return s.Length>100?s.Substring(0,100):s;
        }
        private static bool Flag(Dictionary<string,object> row,string name)
        {
            object value;
            return row!=null&&row.TryGetValue(name,out value)&&value is bool&&(bool)value;
        }
        private void Selected()
        {
            if(tvs.SelectedItems.Count<1)return;
            bool current=tvs.SelectedItems[0].Tag is bool&&(bool)tvs.SelectedItems[0].Tag;
            details.Text=current
                ?"Saved LG address. Discovery does not confirm identity, connection or playback."
                :"Detected on Wi-Fi. Connecting to this platform is not yet supported by this private preview.";
        }
        private void Scan()
        {
            if(running||IsDisposed)return;
            var selected=networks.SelectedItem as NetworkChoice;
            if(selected==null){summary.Text="Select the PC network before scanning.";return;}
            string input=new JavaScriptSerializer().Serialize(new {adapterName=selected.Name,localIp=selected.IP});
            running=true;rescan.Enabled=false;
            summary.Text="Searching local Wi-Fi (about four seconds)...";
            details.Text="Read-only search: no TV pairing, changes or interruptions.";
            ThreadPool.QueueUserWorkItem(delegate
            {
                string result="",error="";bool ok=false;
                try
                {
                    result=RunFinder("--scan",input);ok=true;
                }
                catch(Exception e){error=e.Message;}
                if(IsDisposed||!IsHandleCreated)return;
                bool success=ok;string json=result;string problem=error;
                try{BeginInvoke((Action)delegate
                {
                    running=false;rescan.Enabled=true;
                    if(!success)
                    {
                        summary.Text="TV discovery unavailable.";
                        details.Text=problem.Length>160?problem.Substring(0,160):problem;return;
                    }
                    try{Display(json);}
                    catch{summary.Text="Unexpected TV search result.";details.Text="Nothing has changed on your existing TV.";}
                });}catch(InvalidOperationException){}
            });
        }
        private void Display(string json)
        {
            var ser=new JavaScriptSerializer();
            var response=ser.DeserializeObject(json) as Dictionary<string,object>;
            if(response==null||!Flag(response,"ok")||!Flag(response,"readOnly"))throw new Exception();
            object list;
            if(!response.TryGetValue("devices",out list))throw new Exception();
            var rows=list as object[];
            if(rows==null)throw new Exception();
            tvs.BeginUpdate();
            try
            {
                tvs.Items.Clear();
                foreach(object r in rows)
                {
                    var data=r as Dictionary<string,object>;if(data==null)continue;
                    string name=Field(data,"name"),brand=Field(data,"brand"),
                        ip=Field(data,"ip"),connection=Field(data,"connection");
                    if(name.Length==0||ip.Length==0)continue;
                    bool current=Flag(data,"current"),found=Flag(data,"found");
                    var item=new ListViewItem((current?"● ":"")+name+(found?"":" (saved)"));
                    item.SubItems.Add(brand);item.SubItems.Add(ip);
                    item.SubItems.Add(connection);item.Tag=current;
                    if(current)item.BackColor=Color.FromArgb(233,246,237);
                    tvs.Items.Add(item);
                    if(current)item.Selected=true;
                }
            }finally{tvs.EndUpdate();}
            summary.Text=tvs.Items.Count+" device(s) listed. SSDP and mDNS network discovery.";
            if(tvs.Items.Count==0)details.Text="Nothing responded. Ensure the TV and PC share the same Wi-Fi and try again.";
        }
    }
}
