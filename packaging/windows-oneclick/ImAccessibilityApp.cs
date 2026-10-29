using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Net;
using System.Threading.Tasks;

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
 class FoundTV {
  public string IP,Name,Brand,Kind;
  public bool IsLG {get{return String.Equals(Brand,"LG",StringComparison.OrdinalIgnoreCase);}}
  public override string ToString(){
   string name=String.IsNullOrWhiteSpace(Name)?Brand:Name;
   return name+" | "+IP+" | "+(IsLG?"LG webOS (model checked on connection)":"Found - viewing not yet supported");
  }
 }
 class MainWindow:Form {
  ComboBox adapters=new ComboBox();
  ListBox televisions=new ListBox();
  TextBox tvIP=new TextBox(),log=new TextBox();
  CheckBox confirm=new CheckBox(),sound=new CheckBox();
  Button find=new Button(),save=new Button(),start=new Button(),stop=new Button(),status=new Button(),uninstall=new Button();
  Label state=new Label();
  bool scanning=false;
  public MainWindow(){
   Text="I'm-accessibility - Find TVs on your Wi-Fi";Font=new Font("Segoe UI",10);
   BackColor=Color.FromArgb(247,249,250);ForeColor=Color.FromArgb(28,42,56);
   Size=new Size(780,830);MinimumSize=new Size(700,570);
   StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Font;
   AutoScroll=true;AutoScrollMinSize=new Size(735,815);
   AddLabel("I'm-accessibility",28,20,690,44,20,true);
   AddLabel("Find a television on your Wi-Fi. No IP address to type.",30,74,690,27);
   Panel bar=new Panel{Left=28,Top=109,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(bar);
   AddLabel("1   FIND YOUR TV",28,130,680,27,11,true);
   AddLabel("PC network",30,174,117,25);
   adapters.SetBounds(156,169,547,33);adapters.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(adapters);
   find.Text="Find TVs on Wi-Fi";find.SetBounds(156,212,206,43);Primary(find);Controls.Add(find);
   AddLabel("Select the network, then choose your TV below.",377,214,340,48);
   televisions.SetBounds(30,278,692,143);televisions.IntegralHeight=false;
   televisions.HorizontalScrollbar=true;Controls.Add(televisions);
   AddLabel("Selected TV",30,437,117,26);
   tvIP.SetBounds(156,431,205,32);tvIP.MaxLength=22;tvIP.ReadOnly=true;
   tvIP.Text="Select a TV above";Controls.Add(tvIP);
   AddLabel("Finds many brands. Desktop viewing currently supports LG webOS.",375,429,341,44);
   confirm.SetBounds(155,475,540,31);confirm.Text="I confirm this is my television.";confirm.Enabled=false;Controls.Add(confirm);
   save.Text="Save selected TV";save.SetBounds(155,518,203,43);Primary(save);
   save.Enabled=false;save.Click+=(s,e)=>Save();Controls.Add(save);
   state.SetBounds(366,515,350,44);state.Text="Checking setup...";Controls.Add(state);
   Panel second=new Panel{Left=28,Top=582,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(second);
   AddLabel("2   USE YOUR TV",28,599,675,28,11,true);
   sound.SetBounds(29,635,675,29);
   sound.Text="Enable TV speaker sound (may temporarily mute laptop speakers)";
   Controls.Add(sound);
   start.Text="Start desktop on TV";start.SetBounds(30,677,223,44);Primary(start);Controls.Add(start);
   stop.Text="Stop TV stream";stop.SetBounds(265,677,181,44);Controls.Add(stop);
   status.Text="Refresh status";status.SetBounds(457,677,149,44);Controls.Add(status);
   uninstall.Text="Uninstall";uninstall.SetBounds(617,677,104,44);Controls.Add(uninstall);
   start.Click+=(s,e)=>StartTV();stop.Click+=(s,e)=>StopTV();status.Click+=(s,e)=>Status();
   uninstall.Click+=(s,e)=>Uninstall();
   find.Click+=(s,e)=>FindTVs();televisions.SelectedIndexChanged+=(s,e)=>SelectTV();
   adapters.SelectedIndexChanged+=(s,e)=>{
    if(File.Exists(Engine.Settings)||scanning)return;
    televisions.Items.Clear();tvIP.Text="Select a TV above";confirm.Checked=false;
    confirm.Enabled=false;save.Enabled=false;state.Text="Choose Find TVs to scan this network.";
   };
   log.SetBounds(30,738,691,60);log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;
   log.Anchor=AnchorStyles.Left|AnchorStyles.Right|AnchorStyles.Top;
   log.Text="Ready. Nothing starts streaming until you press Start.";Controls.Add(log);
   KeyPreview=true;KeyDown+=(sender,e)=>{if(e.KeyCode==Keys.F5){Status();e.Handled=true;e.SuppressKeyPress=true;}};
   adapters.TabIndex=0;adapters.AccessibleName="PC network connection";
   adapters.AccessibleDescription="Select the private Wi-Fi or Ethernet network where the TV is connected.";
   find.TabIndex=1;find.AccessibleName="Find TVs on selected Wi-Fi";
   find.AccessibleDescription="Read-only local discovery. No TV launch, pairing or system changes.";
   televisions.TabIndex=2;televisions.AccessibleName="Televisions found on your Wi-Fi";
   televisions.AccessibleDescription="Select an LG webOS TV. Other discovered devices may not support Windows desktop streaming yet.";
   tvIP.TabIndex=3;tvIP.TabStop=true;tvIP.AccessibleName="LG television IPv4 address";
   tvIP.AccessibleDescription="Filled automatically when you select a discovered TV. No typing required.";
   confirm.TabIndex=4;confirm.AccessibleName="Confirm this is my own LG television";
   confirm.AccessibleDescription="Required acknowledgement before saving a discovered LG.";
   save.TabIndex=5;save.AccessibleName="Save LG television setup";
   save.AccessibleDescription="Save the selected LG television and current local network.";
   sound.TabIndex=6;sound.AccessibleName="Enable LG television speaker audio";
   sound.AccessibleDescription="When selected, TV sound may temporarily mute laptop output.";
   start.TabIndex=7;start.AccessibleName="Start Windows desktop streaming to LG TV";
   start.AccessibleDescription="Requires confirmation. Windows mouse control remains off until explicitly enabled.";
   stop.TabIndex=8;stop.AccessibleName="Stop this application's TV stream";
   stop.AccessibleDescription="Owner-confirmed Stop does not shut down other programs.";
   status.TabIndex=9;status.AccessibleName="Refresh TV streaming status";
   status.AccessibleDescription="Read current session state. Keyboard shortcut F5.";
   uninstall.TabIndex=10;uninstall.AccessibleName="Open accessible application uninstaller";
   uninstall.AccessibleDescription="Stop the TV session before uninstalling.";
   log.TabIndex=11;log.TabStop=true;log.AccessibleName="TV application activity and status messages";
   log.AccessibleDescription="Read-only log of setup, discovery, and streaming status.";
   state.AccessibleName="LG television setup status";
   Load+=(s,e)=>Initialize();
  }
  public object AccessibilityReport(){
   Control[] ordered={adapters,find,televisions,tvIP,confirm,save,sound,start,stop,status,uninstall,log};
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
  void Log(string message){log.AppendText("\r\n"+DateTime.Now.ToString("HH:mm:ss")+"  "+message);}
  void Initialize(){
   try{
    var d=Engine.Parse(Engine.Run("doctor",null,false));
    var list=d["adapters"] as ArrayList;
    if(list!=null)foreach(object item in list){
     var map=item as Dictionary<string,object>;if(map==null)continue;
     adapters.Items.Add(new Adapter{Name=Engine.Field(map,"name"),IP=Engine.Field(map,"ip"),Mask=Engine.Field(map,"mask")});
    }
    if(adapters.Items.Count>0){
     int preferred=0;
     for(int i=0;i<adapters.Items.Count;i++){
      string name=((Adapter)adapters.Items[i]).Name.ToLowerInvariant();
      if(name.Contains("wi-fi")||name.Contains("wifi")||name.Contains("wireless")){preferred=i;break;}
     }
     adapters.SelectedIndex=preferred;
    }
    if(File.Exists(Engine.Settings)){
     state.Text="Configuration already saved.";
     find.Enabled=false;save.Enabled=false;confirm.Enabled=false;tvIP.ReadOnly=true;
     adapters.Enabled=false;televisions.Enabled=false;
     try{
      var settings=Engine.Parse(File.ReadAllText(Engine.Settings,Encoding.UTF8));
      tvIP.Text=Engine.Field(settings["television"] as Dictionary<string,object>,"ip");
      string ip=Engine.Field(settings["network"] as Dictionary<string,object>,"localIp");
      for(int i=0;i<adapters.Items.Count;i++)
       if(((Adapter)adapters.Items[i]).IP==ip)adapters.SelectedIndex=i;
     }catch{Log("Existing TV settings need inspection before Start.");}
    }else if(adapters.Items.Count>0){
     state.Text="Ready to find TVs...";
     BeginInvoke(new Action(()=>FindTVs()));
    }else{state.Text="Connect your PC to a local network, then retry.";find.Enabled=false;}
    Status();
   }catch(Exception ex){Log("Setup check: "+ex.Message);start.Enabled=false;save.Enabled=false;}
  }
  async void FindTVs(){
   var selected=adapters.SelectedItem as Adapter;
   if(scanning||File.Exists(Engine.Settings))return;
   if(selected==null){state.Text="Choose a PC network first.";return;}
   scanning=true;find.Enabled=false;televisions.Enabled=false;
   televisions.Items.Clear();tvIP.Text="Searching...";confirm.Checked=false;
   confirm.Enabled=false;save.Enabled=false;state.Text="Searching TVs on your Wi-Fi...";
   try{
    var data=new Dictionary<string,object>{{"adapterName",selected.Name},{"localIp",selected.IP}};
    string input=new JavaScriptSerializer().Serialize(data);
    string raw=await Task.Run(()=>Engine.Run("discover",input,false));
    if(Disposing||IsDisposed)return;
    if(adapters.SelectedItem!=selected){state.Text="Network changed. Scan again.";return;}
    var reply=Engine.Parse(raw);
    var rows=reply.ContainsKey("devices")?reply["devices"] as ArrayList:null;
    if(rows!=null)foreach(object value in rows){
     var device=value as Dictionary<string,object>;if(device==null)continue;
     if(!device.ContainsKey("found")||!(device["found"] is bool)||!(bool)device["found"])continue;
     string address=Engine.Field(device,"ip");
     IPAddress parsed;
     if(!IPAddress.TryParse(address,out parsed)||parsed.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork)continue;
     televisions.Items.Add(new FoundTV{IP=address,Name=Engine.Field(device,"name"),
      Brand=Engine.Field(device,"brand"),Kind=Engine.Field(device,"kind")});
    }
    tvIP.Text="Select a TV above";
    state.Text=televisions.Items.Count==0?"No TVs found. Try Find TVs again.":
     televisions.Items.Count+" device(s) found. Select your TV.";
    if(televisions.Items.Count==0)Log("No TV announced itself; some networks block discovery even when TVs are online.");
    else Log("Found "+televisions.Items.Count+" TV/receiver device(s). Select from the list.");
   }catch(Exception ex){state.Text="TV discovery unavailable.";Log("Find TVs: "+ex.Message);}
   finally{scanning=false;if(!IsDisposed){find.Enabled=!File.Exists(Engine.Settings);televisions.Enabled=true;}}
  }
  void SelectTV(){
   if(scanning||File.Exists(Engine.Settings))return;
   var chosen=televisions.SelectedItem as FoundTV;
   confirm.Checked=false;
   confirm.Enabled=chosen!=null&&chosen.IsLG;
   save.Enabled=chosen!=null&&chosen.IsLG;
   tvIP.Text=chosen==null?"Select a TV above":chosen.IP;
   if(chosen==null)return;
   state.Text=chosen.IsLG?"LG found. Confirm and Save.":"Found; desktop viewing is not supported for "+chosen.Brand+".";
   if(!chosen.IsLG)Log("This TV is discoverable; desktop viewing currently supports only tested LG webOS.");
  }
  void Save(){
   var a=adapters.SelectedItem as Adapter;
   var chosen=televisions.SelectedItem as FoundTV;
   if(a==null||chosen==null||!chosen.IsLG||chosen.IP!=tvIP.Text){
    Log("Select an LG webOS TV from the Find TVs results first.");return;
   }
   if(!confirm.Checked){Log("Confirm this is your own television before saving.");return;}
   try{
    var data=new Dictionary<string,object>{{"adapterName",a.Name},{"localIp",a.IP},
     {"tvIp",chosen.IP},{"nodeExe",Engine.Node},{"ffmpegExe",Engine.Ffmpeg}};
    Engine.Run("save",new JavaScriptSerializer().Serialize(data),false);
    state.Text="TV setup saved.";save.Enabled=false;find.Enabled=false;adapters.Enabled=false;
    televisions.Enabled=false;confirm.Enabled=false;
    Log("LG TV selected. The hardware model is checked when the connection starts.");
   }catch(Exception ex){Log("Setup refused: "+ex.Message);}
  }
  void StartTV(){
   if(!File.Exists(Engine.Settings)){Log("Select and save your LG TV first.");return;}
   string s="Open the Windows desktop stream on your selected LG TV?\r\n"+
     (sound.Checked?"TV audio will be enabled.":"TV audio will stay disabled.")+
     "\r\nWindows mouse control will remain OFF until you enable it on the TV.";
   if(MessageBox.Show(this,s,"Confirm TV start",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Engine.Run("validate",null,false);Log(Engine.Run("start",null,sound.Checked));}
   catch(Exception ex){Log("Start refused: "+ex.Message);}
  }
  void StopTV(){
   if(MessageBox.Show(this,"Stop this TV stream only?","Confirm stop",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Log(Engine.Run("stop",null,false));}catch(Exception ex){Log("Stop failed: "+ex.Message);}
  }
  void Status(){
   try{var d=Engine.Parse(Engine.Run("status",null,false));
    Log("State "+Engine.Field(d,"state")+" | video "+Engine.Field(d,"stream")+
     " | viewer "+Engine.Field(d,"viewer")+" | LG "+Engine.Field(d,"lg"));
   }catch(Exception ex){Log("Status: "+ex.Message);}
  }
  void Uninstall(){
   var target=Path.Combine(Engine.Root,"ImAccessibility-Uninstall.exe");
   if(!File.Exists(target)){Log("Uninstaller missing.");return;}
   if(MessageBox.Show(this,"Open the uninstaller? It will check that the TV stream is stopped.",
     "Uninstall",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Process.Start(new ProcessStartInfo(target){UseShellExecute=true});Close();}
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
