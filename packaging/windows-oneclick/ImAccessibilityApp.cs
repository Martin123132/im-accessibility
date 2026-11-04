using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Collections;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Net;

namespace ImAccessibilityDesktop {
 static class Engine {
  public static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
  public static readonly string Node=Path.Combine(Root,"Runtime","node.exe");
  public static readonly string Ffmpeg=Path.Combine(Root,"Runtime","ffmpeg.exe");
  public static readonly string Bridge=Path.Combine(Root,"gui-config-bridge.cjs");
  public static string LocalData {get{
   string v=Environment.GetEnvironmentVariable("LOCALAPPDATA");
   return String.IsNullOrWhiteSpace(v)?Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData):v;
  }}
  public static string Settings {get{return Path.Combine(LocalData,"ImAccessibility","settings.json");}}
  public static string Quote(string s){return "\""+s.Replace("\"","\\\"")+"\"";}
  public static string Run(string op,string input,bool audio) {
   if(!File.Exists(Node)||!File.Exists(Ffmpeg)||!File.Exists(Bridge))throw new IOException("Bundled Node, FFmpeg or app controller is missing.");
   var si=new ProcessStartInfo(Node,Quote(Bridge)+" "+op);
   si.WorkingDirectory=Root;si.UseShellExecute=false;si.CreateNoWindow=true;
   si.RedirectStandardInput=true;si.RedirectStandardOutput=true;si.RedirectStandardError=true;
   si.StandardOutputEncoding=Encoding.UTF8;si.StandardErrorEncoding=Encoding.UTF8;
   si.EnvironmentVariables["PC_BRIDGE_FFMPEG_EXE"]=Ffmpeg;
   si.EnvironmentVariables["IM_ACCESSIBILITY_CONFIG_PATH"]=Settings;
   si.EnvironmentVariables["IM_ACCESSIBILITY_TV_AUDIO"]=audio?"1":"0";
   using(var p=new Process()) {
    p.StartInfo=si;p.Start();
    if(input!=null)p.StandardInput.Write(input);
    p.StandardInput.Close();
    string output=p.StandardOutput.ReadToEnd(),error=p.StandardError.ReadToEnd();
    if(!p.WaitForExit(15000)){try{p.Kill();}catch{}throw new Exception("Local "+op+" timed out.");}
    if(p.ExitCode!=0)throw new Exception(String.IsNullOrWhiteSpace(error)?output.Trim():error.Trim());
    return output.Trim();
   }
  }
  public static Dictionary<string,object> Parse(string s){return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(s);}
  public static string Field(Dictionary<string,object> d,string k){return d!=null&&d.ContainsKey(k)&&d[k]!=null?Convert.ToString(d[k]):"";}
 }
 class Adapter {public string Name,IP,Mask;public override string ToString(){return Name+"  |  "+IP+"  ("+Mask+")";}}
 class MainWindow:Form {
  ComboBox adapters=new ComboBox();
  TextBox tvIP=new TextBox(),log=new TextBox();
  CheckBox confirm=new CheckBox(),sound=new CheckBox();
  Button save=new Button(),start=new Button(),stop=new Button(),status=new Button(),uninstall=new Button(),findTvs=new Button();
  Label state=new Label();
   readonly System.Windows.Forms.Timer presentationPoll=new System.Windows.Forms.Timer();
   int presentationTries; bool presentationBusy;
  public MainWindow(){
   Text="I'm-accessibility - Windows desktop to TV";Font=new Font("Segoe UI",10);
   BackColor=Color.FromArgb(247,249,250);ForeColor=Color.FromArgb(28,42,56);
   Size=new Size(775,650);MinimumSize=new Size(710,600);
   StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Font;
   AddLabel("I'm-accessibility",28,20,680,44,20,true);
   AddLabel("Share your Windows desktop with your television. You stay in control.",30,74,695,27);
   Panel bar=new Panel{Left=28,Top=109,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(bar);
   AddLabel("1   FIND AND CONNECT A TV",28,130,680,27,11,true);
   AddLabel("PC network",30,174,117,25);
   adapters.SetBounds(156,169,547,33);adapters.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(adapters);
   AddLabel("TV address",30,218,117,26);
   tvIP.SetBounds(156,213,195,32);tvIP.MaxLength=15;Controls.Add(tvIP);
   findTvs.Text="Find TVs";findTvs.SetBounds(365,213,133,33);
    findTvs.Click+=(s,e)=>DiscoverTVs();Controls.Add(findTvs);
    AddLabel("LG webOS connection preview. Other TVs are discovery-only.",507,206,212,55);
   confirm.SetBounds(155,260,540,30);confirm.Text="I confirm I own or am authorised to connect to this television.";Controls.Add(confirm);
   save.Text="Save setup";save.SetBounds(155,304,172,40);Primary(save);save.Click+=(s,e)=>Save();
   Controls.Add(save);
   state.SetBounds(345,312,350,30);state.Text="Checking setup...";Controls.Add(state);
   Panel second=new Panel{Left=28,Top=367,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(second);
   AddLabel("2   USE YOUR TV",28,386,675,28,11,true);
   sound.SetBounds(29,424,675,29);
   sound.Text="Enable TV speaker sound (may temporarily mute the laptop speakers)";
   Controls.Add(sound);
   start.Text="Start desktop on TV";start.SetBounds(30,468,223,44);Primary(start);Controls.Add(start);
   stop.Text="Stop TV stream";stop.SetBounds(265,468,181,44);Controls.Add(stop);
   status.Text="Refresh status";status.SetBounds(457,468,149,44);Controls.Add(status);
   uninstall.Text="Uninstall";uninstall.SetBounds(617,468,104,44);Controls.Add(uninstall);
   start.Click+=(s,e)=>StartTV();stop.Click+=(s,e)=>StopTV();status.Click+=(s,e)=>Status();
   uninstall.Click+=(s,e)=>Uninstall();
   log.SetBounds(30,529,691,74);log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;
   log.Anchor=AnchorStyles.Left|AnchorStyles.Right|AnchorStyles.Bottom|AnchorStyles.Top;
   log.Text="Ready. Nothing starts streaming until you press Start.";
   Controls.Add(log);
    presentationPoll.Interval=1800;
    presentationPoll.Tick+=(sender,e)=>ProbeDesktopReady();
   // Intentional tab sequence: network, address, confirmation, save, sound,
   // start/stop/status, uninstall, then the read-only announcement log.
   // No keyboard shortcut starts Windows capture or arms the mouse.
   KeyPreview=true;
   KeyDown+=(sender,e)=>{if(e.KeyCode==Keys.F5){Status();e.Handled=true;e.SuppressKeyPress=true;}};
   adapters.TabIndex=0;adapters.AccessibleName="PC network connection";
   adapters.AccessibleDescription="Select your private Wi-Fi or Ethernet network for television discovery.";
   tvIP.TabIndex=1;tvIP.AccessibleName="Television IPv4 address";
   tvIP.AccessibleDescription="The address shown in the television's network settings.";
   findTvs.TabIndex=2;findTvs.AccessibleName="Find TVs on my local network";
    findTvs.AccessibleDescription="Read-only discovery of nearby televisions before configuration is saved.";
    confirm.TabIndex=3;confirm.AccessibleName="Confirm I am authorised to connect to this television";
   confirm.AccessibleDescription="Required acknowledgement before saving device configuration.";
   save.TabIndex=4;save.AccessibleName="Save supported television setup";
   save.AccessibleDescription="Validate the selected network and TV address and save settings locally.";
   sound.TabIndex=5;sound.AccessibleName="Enable television speaker audio";
   sound.AccessibleDescription="When selected, the TV plays speaker audio and the laptop may be temporarily muted.";
   start.TabIndex=6;start.AccessibleName="Start Windows desktop streaming to the selected television";
   start.AccessibleDescription="Requires a confirmation dialog and never enables Windows mouse control automatically.";
   stop.TabIndex=7;stop.AccessibleName="Stop this application's TV stream";
   stop.AccessibleDescription="Requires confirmation; does not shut down other applications.";
   status.TabIndex=8;status.AccessibleName="Refresh TV streaming status";
   status.AccessibleDescription="Read the current TV connection state. Keyboard shortcut F5.";
   uninstall.TabIndex=9;uninstall.AccessibleName="Open accessible application uninstaller";
   uninstall.AccessibleDescription="Confirm to open Windows uninstallation; streaming must be stopped first.";
   log.TabIndex=10;log.TabStop=true;log.AccessibleName="TV application activity and status messages";
   log.AccessibleDescription="Read-only log of setup, connection and local application state.";
   state.AccessibleName="Television setup status";
   Load+=(s,e)=>Initialize();
  }
  public object AccessibilityReport(){
   Control[] ordered={adapters,tvIP,findTvs,confirm,save,sound,start,stop,status,uninstall,log};
   var records=new List<Dictionary<string,object>>();
   bool named=true,tabOrder=true,allTabStops=true;
   for(int i=0;i<ordered.Length;i++){
    Control c=ordered[i];
    if(String.IsNullOrWhiteSpace(c.AccessibleName))named=false;
    if(c.TabIndex!=i)tabOrder=false;
    if(!c.TabStop)allTabStops=false;
    records.Add(new Dictionary<string,object>{
     {"name",c.AccessibleName},{"description",c.AccessibleDescription},
     {"role",c.AccessibilityObject.Role.ToString()},{"tabIndex",c.TabIndex},
     {"tabStop",c.TabStop},{"type",c.GetType().Name}
    });
   }
   return new {window=Text,allNamed=named,tabOrderValid=tabOrder,
    allTabStops=allTabStops,controlCount=records.Count,controls=records};
  }
  void AddLabel(string text,int x,int y,int w,int h,int pt=10,bool strong=false){
   Controls.Add(new Label{Left=x,Top=y,Width=w,Height=h,Text=text,
    Font=new Font("Segoe UI",pt,strong?FontStyle.Bold:FontStyle.Regular),
    ForeColor=strong?Color.FromArgb(24,75,112):Color.FromArgb(34,48,61)});
  }
  static void Primary(Button b){b.BackColor=Color.FromArgb(17,94,142);b.ForeColor=Color.White;
   b.FlatStyle=FlatStyle.Flat;b.FlatAppearance.BorderSize=0;b.Font=new Font("Segoe UI",10,FontStyle.Bold);}
  void Log(string s){log.AppendText("\r\n"+DateTime.Now.ToString("HH:mm:ss")+"  "+s);}
  void Initialize(){
   try{
    var d=Engine.Parse(Engine.Run("doctor",null,false));
    var list=d["adapters"] as ArrayList;
    if(list!=null)foreach(object item in list){
     var map=item as Dictionary<string,object>;if(map==null)continue;
     adapters.Items.Add(new Adapter{Name=Engine.Field(map,"name"),IP=Engine.Field(map,"ip"),Mask=Engine.Field(map,"mask")});
    }
    if(adapters.Items.Count>0)adapters.SelectedIndex=0;
    if(File.Exists(Engine.Settings)){
     state.Text="Configuration already saved.";
     save.Enabled=false;confirm.Enabled=false;tvIP.ReadOnly=true;adapters.Enabled=false;
     try{
      var settings=Engine.Parse(File.ReadAllText(Engine.Settings,Encoding.UTF8));
      tvIP.Text=Engine.Field(settings["television"] as Dictionary<string,object>,"ip");
      string ip=Engine.Field(settings["network"] as Dictionary<string,object>,"localIp");
      for(int i=0;i<adapters.Items.Count;i++)if(((Adapter)adapters.Items[i]).IP==ip)adapters.SelectedIndex=i;
     }catch{Log("Existing TV settings need inspection before Start.");}
    }else state.Text="Not configured.";
    Status();
   }catch(Exception ex){Log("Setup check: "+ex.Message);start.Enabled=false;save.Enabled=false;}
  }
   // Discovery is independent of saved pairing credentials and streaming.
   void DiscoverTVs(){
    var net=adapters.SelectedItem as Adapter;
    if(net==null){Log("Choose your PC network before searching.");return;}
    if(!findTvs.Enabled)return;
    findTvs.Enabled=false;
    Log("Searching the selected local network for TVs and receivers...");
    var input=new JavaScriptSerializer().Serialize(
      new Dictionary<string,object>{{"adapterName",net.Name},{"localIp",net.IP}});
    ThreadPool.QueueUserWorkItem(delegate{
      string result=null,error=null;
      try{result=Engine.Run("discover",input,false);}
      catch(Exception ex){error=ex.Message;}
      if(IsDisposed||!IsHandleCreated)return;
      try{BeginInvoke((Action)delegate{
        findTvs.Enabled=true;
        if(error!=null){Log("Discovery unavailable: "+error);return;}
        try{ShowDiscoveredTVs(result);}
        catch(Exception ex){Log("Cannot display TV results: "+ex.Message);}
      });}catch(InvalidOperationException){}
    });
   }
   void ShowDiscoveredTVs(string json){
    var response=Engine.Parse(json);
    object found;
    var rows=response!=null&&response.TryGetValue("devices",out found)
      ?found as ArrayList:null;
    if(rows==null)throw new Exception("Invalid TV discovery response.");
    using(var dialog=new Form()){
      dialog.Text="Nearby TVs and streaming devices";
      dialog.ClientSize=new Size(745,395);
      dialog.StartPosition=FormStartPosition.CenterParent;
      dialog.FormBorderStyle=FormBorderStyle.FixedDialog;
      dialog.MaximizeBox=false;dialog.MinimizeBox=false;
      dialog.Font=new Font("Segoe UI",9.5f);
      var heading=new Label{Left=17,Top=14,Width=711,Height=46,
       Text="Choose a TV. A device being detected does not guarantee streaming support."};
      dialog.Controls.Add(heading);
      var list=new ListView{Left=17,Top=62,Width=711,Height=248,
       View=View.Details,FullRowSelect=true,MultiSelect=false,GridLines=true};
      list.Columns.Add("Device",192);list.Columns.Add("Brand",97);
      list.Columns.Add("IP address",115);list.Columns.Add("Connection status",302);
      foreach(object row in rows){
       var device=row as Dictionary<string,object>;if(device==null)continue;
       string ip=Engine.Field(device,"ip");if(ip.Length==0)continue;
       var entry=new ListViewItem(Engine.Field(device,"name"));
       entry.SubItems.Add(Engine.Field(device,"brand"));
       entry.SubItems.Add(ip);
       entry.SubItems.Add(Engine.Field(device,"status"));
       entry.Tag=device;list.Items.Add(entry);
      }
      dialog.Controls.Add(list);
      var note=new Label{Left=17,Top=315,Width=711,Height=29,
       Text="The owner-tested connection is LG OLED55CX6LA. Other TV adapters are in development."};
      dialog.Controls.Add(note);
      var pick=new Button{Left=17,Top=349,Width=169,Height=32,Text="Use selected TV"};
      pick.Click+=(s,e)=>{
       if(list.SelectedItems.Count!=1)return;
       var selected=list.SelectedItems[0].Tag as Dictionary<string,object>;
       if(selected==null)return;
       if(Engine.Field(selected,"adapter")!="lg-webos"){
        MessageBox.Show(dialog,
         "This device was detected, but direct casting is not yet implemented for its platform.",
         "Connection not yet available",MessageBoxButtons.OK,MessageBoxIcon.Information);
        return;
       }
       tvIP.Text=Engine.Field(selected,"ip");
       confirm.Checked=false;
       state.Text="LG address chosen; confirm ownership and save.";
       dialog.DialogResult=DialogResult.OK;
       dialog.Close();
      };
      dialog.Controls.Add(pick);
      var close=new Button{Left=607,Top=349,Width=121,Height=32,Text="Close"};
      close.Click+=(s,e)=>dialog.Close();
      dialog.Controls.Add(close);
      Log(list.Items.Count+" devices detected on your local network.");
      dialog.ShowDialog(this);
    }
   }   void Save(){
   var a=adapters.SelectedItem as Adapter;if(a==null){Log("Select a PC network first.");return;}
   if(!confirm.Checked){Log("Confirm that you are authorised to connect to this television.");return;}
   IPAddress ip; if(!IPAddress.TryParse(tvIP.Text.Trim(),out ip)||ip.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork){
    Log("Enter a valid TV IPv4 address.");return;
   }
   try{
    var data=new Dictionary<string,object>{{"adapterName",a.Name},{"localIp",a.IP},{"tvIp",ip.ToString()},
     {"nodeExe",Engine.Node},{"ffmpegExe",Engine.Ffmpeg}};
    Engine.Run("save",new JavaScriptSerializer().Serialize(data),false);
    state.Text="TV setup saved.";save.Enabled=false;adapters.Enabled=false;tvIP.ReadOnly=true;confirm.Enabled=false;
    Log("TV setup validated and saved locally.");
   }catch(Exception ex){Log("Setup refused: "+ex.Message);}
  }
  void StartTV(){
   if(!File.Exists(Engine.Settings)){Log("Save your TV setup first.");return;}
   string s="Open the Windows desktop stream on your selected television?\r\n"+
     (sound.Checked?"TV audio will be enabled.":"TV audio will stay disabled.")+
     "\r\nWindows mouse control will remain OFF until you enable it on the TV.";
   if(MessageBox.Show(this,s,"Confirm TV start",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{
     Engine.Run("validate",null,false);
     Log(Engine.Run("start",null,sound.Checked));
     presentationTries=0;
     presentationPoll.Start();
    }
   catch(Exception ex){Log("Start refused: "+ex.Message);}
  }
  void StopTV(){
    presentationPoll.Stop();
   if(MessageBox.Show(this,"Stop this TV stream only?","Confirm stop",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Log(Engine.Run("stop",null,false));}catch(Exception ex){Log("Stop failed: "+ex.Message);}
  }
     // Minimise this control window only; preserve any user's chosen desktop app.
   void ProbeDesktopReady(){
    if(presentationBusy || !presentationPoll.Enabled)return;
    presentationBusy=true;
    ThreadPool.QueueUserWorkItem(delegate{
     bool connected=false;
     try{
      var data=Engine.Parse(Engine.Run("status",null,false));
      connected=Engine.Field(data,"viewer")=="ready"&&Engine.Field(data,"lg")=="opened"
        &&Engine.Field(data,"stream")=="ready";
     }catch{}
     if(IsDisposed || !IsHandleCreated)return;
     try{BeginInvoke((Action)delegate{
      presentationBusy=false;
      if(!presentationPoll.Enabled)return;
      presentationTries++;
      if(connected){
       presentationPoll.Stop();
       WindowState=FormWindowState.Minimized;
      }else if(presentationTries>=15){
       presentationPoll.Stop();
       Log("TV connection not confirmed; controls remain open for inspection.");
      }
     });}catch(InvalidOperationException){}
    });
   }void Status(){
   try{var d=Engine.Parse(Engine.Run("status",null,false));
    Log("State "+Engine.Field(d,"state")+" | video "+Engine.Field(d,"stream")+
     " | viewer "+Engine.Field(d,"viewer")+" | TV "+Engine.Field(d,"lg"));
   }catch(Exception ex){Log("Status: "+ex.Message);}
  }
  void Uninstall(){
   var path=Path.Combine(Engine.Root,"ImAccessibility-Uninstall.exe");
   if(!File.Exists(path)){Log("Uninstaller missing.");return;}
   if(MessageBox.Show(this,"Open the uninstaller? It will check that the TV stream is stopped.",
     "Uninstall",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Process.Start(new ProcessStartInfo(path){UseShellExecute=true});Close();}
   catch(Exception ex){Log(ex.Message);}
  }
 }
 static class Program{
  [STAThread] static void Main(string[] args){
   if(args.Length==2&&args[0]=="--accessibility-selftest"){
    try{
     using(var window=new MainWindow()){
      File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(window.AccessibilityReport()),Encoding.UTF8);
     }
    }catch(Exception ex){File.WriteAllText(args[1],"{\"error\":"+new JavaScriptSerializer().Serialize(ex.Message)+"}",Encoding.UTF8);}
    return;
   }
   if(args.Length==2&&args[0]=="--selftest"){
    try{File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(new{
     app="ImAccessibility Desktop",node=File.Exists(Engine.Node),ffmpeg=File.Exists(Engine.Ffmpeg),
     bridge=File.Exists(Engine.Bridge),settingsPresent=File.Exists(Engine.Settings)
    }),Encoding.UTF8);}catch{}return;
   }
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   Application.Run(new MainWindow());
  }
 }
}
