using System;
using System.Runtime.InteropServices;
// PC Bridge bounded LG remote mouse driver. No keyboard, app launching or shell access.
internal static class TvPointer {
    [StructLayout(LayoutKind.Sequential)] internal struct Point { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] internal struct MouseInput {
        public int dx, dy;
        public uint mouseData, dwFlags, time;
        public IntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct Input {
        public uint type;
        public MouseInput mi;
    }
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int metric);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out Point p);
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, [In] Input[] inputs, int size);
    const uint MouseType=0, LeftDown=0x0002, LeftUp=0x0004, Wheel=0x0800;
    static Input Mouse(uint flags, uint data) {
        return new Input { type=MouseType, mi=new MouseInput { dwFlags=flags,mouseData=data } };
    }
    static int ParseInt(string s, int min, int max) {
        int n; if(!Int32.TryParse(s,out n)||n<min||n>max)throw new ArgumentException("Invalid bounded coordinate or wheel value");
        return n;
    }
    static string Quote(string s) {
        return "\"" + s.Replace("\\","\\\\").Replace("\"","\\\"") + "\"";
    }
    static void Emit(bool ok, string action, int w,int h,Point p,int count) {
        Console.WriteLine("{\"ok\":"+(ok?"true":"false")+",\"action\":"+Quote(action)+
          ",\"width\":"+w+",\"height\":"+h+",\"cursorX\":"+p.X+",\"cursorY\":"+p.Y+",\"events\":"+count+"}");
    }
    static int Main(string[] args) {
        try {
            try { SetProcessDPIAware(); } catch {}
            int w=GetSystemMetrics(0),h=GetSystemMetrics(1);
            if(w<640||h<480||w>8192||h>4320)throw new InvalidOperationException("Unexpected primary display dimensions");
            if(args.Length==0)throw new ArgumentException("Action required");
            string action=args[0];
            if(action=="status" && args.Length==1) {
                Point existing;if(!GetCursorPos(out existing))throw new InvalidOperationException("Cannot inspect cursor");
                Emit(true,action,w,h,existing,0);return 0;
            }
            if((action=="move"||action=="click")&&args.Length==3) {
                int fx=ParseInt(args[1],0,10000),fy=ParseInt(args[2],0,10000);
                int x=(int)Math.Round((w-1)*(double)fx/10000),y=(int)Math.Round((h-1)*(double)fy/10000);
                if(!SetCursorPos(x,y))throw new InvalidOperationException("Windows refused cursor positioning");
                if(action=="click") {
                    var operations=new[]{Mouse(LeftDown,0),Mouse(LeftUp,0)};
                    if(SendInput(2,operations,Marshal.SizeOf(typeof(Input)))!=2)
                        throw new InvalidOperationException("Windows refused mouse click");
                }
                Point actual;if(!GetCursorPos(out actual))throw new InvalidOperationException("Cursor readback failed");
                Emit(true,action,w,h,actual,action=="click"?2:0);return 0;
            }
            if(action=="wheel"&&args.Length==4) {
                int steps=ParseInt(args[1],-3,3);if(steps==0)throw new ArgumentException("Wheel step cannot be zero");
                int fx=ParseInt(args[2],0,10000),fy=ParseInt(args[3],0,10000);
                int x=(int)Math.Round((w-1)*(double)fx/10000),y=(int)Math.Round((h-1)*(double)fy/10000);
                if(!SetCursorPos(x,y))throw new InvalidOperationException("Windows refused cursor positioning");
                uint data=unchecked((uint)(steps*120));
                if(SendInput(1,new[]{Mouse(Wheel,data)},Marshal.SizeOf(typeof(Input)))!=1)
                    throw new InvalidOperationException("Windows refused wheel input");
                Point actual;if(!GetCursorPos(out actual))throw new InvalidOperationException("Cursor readback failed");
                Emit(true,action,w,h,actual,1);return 0;
            }
            throw new ArgumentException("Unsupported mouse action or argument count");
        }catch(Exception e) {
            Console.Error.WriteLine("TV_POINTER_ERROR "+e.GetType().Name+": "+e.Message);
            return 2;
        }
    }
}
