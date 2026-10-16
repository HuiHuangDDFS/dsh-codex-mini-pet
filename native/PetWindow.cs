// Windows-only companion. It owns no Harness credentials or conversation data store.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace DshPet {
  public static class NativeApp {
    static readonly object OutputLock = new object();
    public static JavaScriptSerializer Json { get { return new JavaScriptSerializer { MaxJsonLength = 40 * 1024 * 1024 }; } }
    public static void Emit(object value) {
      lock (OutputLock) { Console.Out.WriteLine(Json.Serialize(value)); Console.Out.Flush(); }
    }
    [STAThread] public static void Run() {
      Console.InputEncoding = new UTF8Encoding(false); Console.OutputEncoding = new UTF8Encoding(false);
      var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
      var window = new PetWindow(); app.MainWindow = window;
      Task.Run(delegate {
        try {
          string line;
          while ((line = Console.ReadLine()) != null) {
            var message = Json.Deserialize<Dictionary<string, object>>(line);
            window.Dispatcher.BeginInvoke(new Action(delegate {
              try { window.Accept(message); } catch (Exception error) { Console.Error.WriteLine(error.Message); }
            }));
          }
        } catch (Exception error) { Console.Error.WriteLine(error.Message); }
        window.Dispatcher.BeginInvoke(new Action(delegate { window.AllowExit = true; app.Shutdown(); }));
      });
      app.Run(window);
    }
  }

  public sealed class PetWindow : Window {
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hwnd, int id);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    const int HotkeyId = 24071;
    readonly Image sprite = new Image();
    readonly StackPanel stack = new StackPanel();
    readonly StackPanel controls = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
    readonly Border toolbar = new Border { CornerRadius = new CornerRadius(9), BorderThickness = new Thickness(.5), Padding = new Thickness(3), Margin = new Thickness(3, 1, 3, 3) };
    readonly Popup chat = new Popup { AllowsTransparency = true, StaysOpen = false, Placement = PlacementMode.Top };
    readonly Popup activity = new Popup { AllowsTransparency = true, StaysOpen = false, Placement = PlacementMode.Top };
    readonly TextBox prompt = new TextBox { AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 76, MaxHeight = 160, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Padding = new Thickness(8), FontSize = 13 };
    readonly TextBlock feedback = new TextBlock { TextWrapping = TextWrapping.Wrap, FontSize = 11, Margin = new Thickness(0, 8, 0, 0) };
    readonly TextBlock workspace = new TextBlock { FontSize = 12, Margin = new Thickness(0, 0, 0, 8), TextTrimming = TextTrimming.CharacterEllipsis };
    readonly StackPanel activities = new StackPanel();
    readonly Button sendButton;
    readonly Button activityButton;
    readonly List<Button> buttons = new List<Button>();
    readonly DispatcherTimer pointer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
    BitmapSource[] frames = new BitmapSource[0];
    Dictionary<string, object> preferences = new Dictionary<string, object>();
    Dictionary<string, object> context = new Dictionary<string, object>();
    string lastRows = "", currentName = "", stateKey = "";
    bool hotkey, mini, hovering, dragging, dark = true, firstPosition = true, pending;
    int gaze = -2, row, column;
    DateTime pendingSince;
    IntPtr handle;
    public bool AllowExit;
    Brush bg = Brushes.White, fg = Brushes.Black, line = Brushes.Gray;

    static object Get(Dictionary<string, object> value, string key) { object result; return value != null && value.TryGetValue(key, out result) ? result : null; }
    static string Str(Dictionary<string, object> value, string key, string fallback = "") { var result = Get(value, key); return result == null ? fallback : Convert.ToString(result); }
    static bool Bool(Dictionary<string, object> value, string key, bool fallback = false) { var result = Get(value, key); return result is bool ? (bool)result : fallback; }
    static double Num(Dictionary<string, object> value, string key, double fallback) { try { var result = Get(value, key); return result == null ? fallback : Convert.ToDouble(result); } catch { return fallback; } }
    static Dictionary<string, object> Obj(Dictionary<string, object> value, string key) { return Get(value, key) as Dictionary<string, object> ?? new Dictionary<string, object>(); }
    Brush Color(string value) { return (Brush)new BrushConverter().ConvertFromString(value); }

    public PetWindow() {
      Title = "DeepSeek Harness · 宠物伙伴"; WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize;
      AllowsTransparency = true; Background = Brushes.Transparent; ShowInTaskbar = false; ShowActivated = false;
      Topmost = true; Width = 170; SizeToContent = SizeToContent.Height; Focusable = true;
      FontFamily = new FontFamily("Segoe UI, Microsoft YaHei");
      stack.Children.Add(sprite); controls.Children.Add(MakeButton("聊一聊", delegate { ToggleChat(); }));
      activityButton = MakeButton("动态", delegate { chat.IsOpen = false; activity.IsOpen = !activity.IsOpen; });
      controls.Children.Add(activityButton); toolbar.Child = controls; stack.Children.Add(toolbar); Content = stack;
      sprite.HorizontalAlignment = HorizontalAlignment.Center; sprite.Stretch = Stretch.Uniform;
      RenderOptions.SetBitmapScalingMode(sprite, BitmapScalingMode.HighQuality);
      chat.PlacementTarget = toolbar; activity.PlacementTarget = toolbar;
      var chatPanel = new StackPanel(); chatPanel.Children.Add(workspace); chatPanel.Children.Add(prompt);
      sendButton = MakeButton("发送", delegate { SendPrompt(); }); sendButton.HorizontalAlignment = HorizontalAlignment.Right; sendButton.Margin = new Thickness(0, 8, 0, 0);
      chatPanel.Children.Add(sendButton); chatPanel.Children.Add(feedback); chat.Child = PopupBorder(chatPanel, 300);
      chatPanel.Children.Add(MakeButton("在主会话编辑", delegate { if (!pending && !String.IsNullOrWhiteSpace(prompt.Text)) { pending = true; pendingSince = DateTime.UtcNow; sendButton.IsEnabled = false; OpenHarness(); NativeApp.Emit(new { type = "edit-chat", text = prompt.Text }); } }));
      activity.Child = PopupBorder(new ScrollViewer { Content = activities, MaxHeight = 380, VerticalScrollBarVisibility = ScrollBarVisibility.Auto }, 290);
      prompt.PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
        if (e.Key == Key.Enter && (Keyboard.Modifiers & ModifierKeys.Shift) == 0) { e.Handled = true; SendPrompt(); }
      };
      sprite.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e) {
        double x = Left, y = Top; dragging = true;
        try { DragMove(); } catch { } dragging = false;
        ClampToScreen();
        if (Math.Abs(x - Left) + Math.Abs(y - Top) > 3) NativeApp.Emit(new { type = "position", x = Left, y = Top });
        else NativeApp.Emit(new { type = "greet" });
      };
      MouseEnter += delegate { hovering = true; UpdateToolbar(); NativeApp.Emit(new { type = "hover", value = true }); };
      MouseLeave += delegate { hovering = false; UpdateToolbar(); NativeApp.Emit(new { type = "hover", value = false }); };
      Deactivated += delegate {
        if (Str(preferences, "visibilityBehavior") == "on-demand" && !activity.IsOpen && !chat.IsOpen) {
          Hide(); NativeApp.Emit(new { type = "preferences", patch = new { visible = false } });
        }
      };
      Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e) {
        if (!AllowExit) { e.Cancel = true; Hide(); NativeApp.Emit(new { type = "preferences", patch = new { visible = false } }); }
      };
      Closed += delegate { pointer.Stop(); if (hotkey) UnregisterHotKey(handle, HotkeyId); };
      SourceInitialized += delegate {
        handle = new WindowInteropHelper(this).Handle; HwndSource.FromHwnd(handle).AddHook(Hook);
        NativeApp.Emit(new { type = "ready", hwnd = handle.ToInt64(), pid = Process.GetCurrentProcess().Id });
      };
      pointer.Tick += delegate { ObservePointer(); }; pointer.Start();
      ApplyTheme(new Dictionary<string, object>()); BuildMenu();
    }
    Button MakeButton(string label, Action action) {
      var border = new FrameworkElementFactory(typeof(Border)); border.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
      border.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
      var content = new FrameworkElementFactory(typeof(ContentPresenter)); content.SetValue(FrameworkElement.MarginProperty, new Thickness(8, 4, 8, 4));
      content.SetValue(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Center); content.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
      border.AppendChild(content);
      var button = new Button { Content = label, FontSize = 11, BorderThickness = new Thickness(0), Cursor = Cursors.Hand, MinHeight = 25, Template = new ControlTemplate(typeof(Button)) { VisualTree = border } };
      button.Click += delegate { action(); }; buttons.Add(button); return button;
    }
    Border PopupBorder(UIElement child, double width) { return new Border { Child = child, Width = width, Padding = new Thickness(12), CornerRadius = new CornerRadius(12), BorderThickness = new Thickness(.5), Margin = new Thickness(5) }; }
    void ApplyTheme(Dictionary<string, object> theme) {
      dark = Bool(theme, "dark", true); bg = Color(dark ? "#242426" : "#FFFFFF"); fg = Color(dark ? "#ECECEF" : "#202124"); line = Color(dark ? "#454548" : "#DADADD");
      toolbar.Background = bg; toolbar.BorderBrush = line;
      foreach (var button in buttons) { button.Background = bg; button.Foreground = fg; }
      foreach (var popup in new Popup[] { chat, activity }) { var border = (Border)popup.Child; border.Background = bg; border.BorderBrush = line; border.TextBlockForeground(fg); }
      prompt.Background = Color(dark ? "#19191B" : "#F6F6F8"); prompt.Foreground = fg; prompt.CaretBrush = fg; prompt.BorderBrush = line;
      workspace.Foreground = fg; feedback.Foreground = fg;
      if (ContextMenu != null) { ContextMenu.Background = bg; ContextMenu.Foreground = fg; }
    }
    void BuildMenu() {
      var menu = new ContextMenu { Background = bg, Foreground = fg };
      AddMenu(menu, "聊一聊", delegate { ToggleChat(); });
      AddMenu(menu, "宠物伙伴设置", delegate { OpenHarness(); NativeApp.Emit(new { type = "open-settings" }); });
      AddMenu(menu, "显示 / 收起形象", delegate { NativeApp.Emit(new { type = "preferences", patch = new { mode = mini ? "pet" : "mini" } }); });
      AddMenu(menu, "改为应用内显示", delegate { NativeApp.Emit(new { type = "preferences", patch = new { surface = "app" } }); });
      AddMenu(menu, "隐藏伙伴", delegate { Hide(); NativeApp.Emit(new { type = "preferences", patch = new { visible = false } }); });
      ContextMenu = menu;
    }
    void AddMenu(ContextMenu menu, string title, Action action) { var item = new MenuItem { Header = title }; item.Click += delegate { action(); }; menu.Items.Add(item); }
    IntPtr Hook(IntPtr hwnd, int message, IntPtr w, IntPtr l, ref bool handled) {
      if (message == 0x312 && w.ToInt32() == HotkeyId) {
        handled = true; if (!IsVisible) Show(); NativeApp.Emit(new { type = "preferences", patch = new { visible = true } }); ToggleChat();
      }
      if (message == 0x21 && !chat.IsOpen) { handled = true; return new IntPtr(3); }
      return IntPtr.Zero;
    }
    void SetHotkey(bool enabled) {
      if (enabled && !hotkey) hotkey = RegisterHotKey(handle, HotkeyId, 1 | 2 | 4 | 0x4000, 0x50);
      if (!enabled && hotkey) { UnregisterHotKey(handle, HotkeyId); hotkey = false; }
      NativeApp.Emit(new { type = "hotkey", registered = hotkey });
    }
    void ToggleChat() {
      activity.IsOpen = false; chat.IsOpen = !chat.IsOpen;
      if (chat.IsOpen) { Activate(); Dispatcher.BeginInvoke(new Action(delegate { prompt.Focus(); Keyboard.Focus(prompt); })); }
    }
    void SendPrompt() {
      if (pending || String.IsNullOrWhiteSpace(prompt.Text)) return;
      pending = true; pendingSince = DateTime.UtcNow; sendButton.IsEnabled = false; feedback.Text = "正在发送…";
      NativeApp.Emit(new { type = "send-chat", text = prompt.Text });
    }
    void OpenHarness() {
      try {
        int pid; if (!Int32.TryParse(Environment.GetEnvironmentVariable("DSH_PET_OWNER_PID"), out pid)) return;
        var window = Process.GetProcessById(pid).MainWindowHandle;
        if (window != IntPtr.Zero) { ShowWindow(window, 9); SetForegroundWindow(window); }
      } catch { }
    }
    void UpdateToolbar() { toolbar.Opacity = mini || hovering || chat.IsOpen || activity.IsOpen ? 1 : 0; toolbar.IsHitTestVisible = toolbar.Opacity > 0; }
    void ObservePointer() {
      UpdateToolbar(); if (!IsVisible || dragging) return;
      POINT point; if (!GetCursorPos(out point)) return;
      var center = PointToScreen(new Point(ActualWidth / 2, sprite.ActualHeight * .4));
      double dx = point.X - center.X, dy = point.Y - center.Y;
      int direction = Math.Sqrt(dx * dx + dy * dy) < 30 ? -1 : ((int)Math.Round((Math.Atan2(dx, -dy) * 180 / Math.PI + 360) % 360 / 22.5)) % 16;
      if (gaze != direction) { gaze = direction; NativeApp.Emit(new { type = "gaze", direction = direction }); }
      if (pending && (DateTime.UtcNow - pendingSince).TotalSeconds > 25) { pending = false; sendButton.IsEnabled = true; feedback.Text = "Harness 暂未响应，请打开主窗口检查。"; }
    }
    void ClampToScreen() {
      try {
        var origin = PointToScreen(new Point(ActualWidth / 2, Math.Max(0, ActualHeight / 2)));
        var screen = System.Windows.Forms.Screen.FromPoint(new System.Drawing.Point((int)origin.X, (int)origin.Y));
        var transform = PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice;
        var tl = transform.Transform(new Point(screen.WorkingArea.Left, screen.WorkingArea.Top));
        var br = transform.Transform(new Point(screen.WorkingArea.Right, screen.WorkingArea.Bottom));
        Left = Math.Max(tl.X, Math.Min(Left, br.X - ActualWidth)); Top = Math.Max(tl.Y, Math.Min(Top, br.Y - ActualHeight));
      } catch { Left = Math.Max(SystemParameters.VirtualScreenLeft, Math.Min(Left, SystemParameters.VirtualScreenLeft + SystemParameters.VirtualScreenWidth - Width)); }
    }
    public void Accept(Dictionary<string, object> message) {
      string type = Str(message, "type");
      if (type == "toggle-chat") { if (!IsVisible) Show(); ToggleChat(); return; }
      if (type == "atlas") {
        var bytes = Convert.FromBase64String(Str(message, "base64")); var image = new BitmapImage();
        using (var stream = new MemoryStream(bytes)) { image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit(); image.Freeze(); }
        frames = new BitmapSource[(image.PixelHeight / 208) * 8];
        for (int r = 0; r < image.PixelHeight / 208; r++) for (int c = 0; c < 8; c++) { var crop = new CroppedBitmap(image, new Int32Rect(c * 192, r * 208, 192, 208)); crop.Freeze(); frames[r * 8 + c] = crop; }
        Draw(); return;
      }
      if (type == "frame") { row = (int)Num(message, "row", 0); column = (int)Num(message, "column", 0); Draw(); return; }
      if (type == "reply") {
        if (Str(message, "kind") != "send-chat" && Str(message, "kind") != "edit-chat") return;
        pending = false; sendButton.IsEnabled = true;
        if (Bool(message, "ok")) { prompt.Clear(); feedback.Text = Str(message, "message", "已发送到 Harness"); } else feedback.Text = Str(message, "error", "发送失败，请在主会话中重试。");
        return;
      }
      if (type == "inspect") {
        int owner; bool minimized = false; if (Int32.TryParse(Environment.GetEnvironmentVariable("DSH_PET_OWNER_PID"), out owner)) { try { minimized = IsIconic(Process.GetProcessById(owner).MainWindowHandle); } catch { } }
        string capture = Str(message, "capturePath");
        if (!String.IsNullOrEmpty(capture)) { var bitmap = new RenderTargetBitmap((int)Math.Ceiling(ActualWidth), (int)Math.Ceiling(ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(this); var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap)); using (var output = File.Create(capture)) encoder.Save(output); }
        NativeApp.Emit(new { type = "inspection", visible = IsVisible, topmost = Topmost, extendedStyle = GetWindowLongPtr(handle, -20).ToInt64(), ownerMinimized = minimized, left = Left, top = Top, name = currentName, frameCount = frames.Length, chatOpen = chat.IsOpen, inputFocused = prompt.IsKeyboardFocused, activityCount = activities.Children.Count }); return;
      }
      if (type != "state") return;
      preferences = Obj(message, "preferences"); context = Obj(message, "context"); currentName = Str(message, "name");
      ToolTip = currentName + " · " + Str(message, "label");
      double scale = Math.Max(.35, Math.Min(1.5, Num(preferences, "scale", .72)));
      mini = Str(preferences, "mode") == "mini"; sprite.Visibility = mini ? Visibility.Collapsed : Visibility.Visible;
      sprite.Width = 192 * scale; sprite.Height = 208 * scale; Width = Math.Max(132, sprite.Width + 8);
      ApplyTheme(Obj(message, "theme"));
      string path = Str(context, "currentWorkspacePath"); workspace.Text = String.IsNullOrEmpty(path) ? "新会话 · 请先在 Harness 选择工作区" : "新会话 · " + System.IO.Path.GetFileName(path.TrimEnd('\\', '/'));
      var rowList = new List<object>(); var incomingRows = Get(message, "rows") as IEnumerable;
      if (incomingRows != null) foreach (var value in incomingRows) rowList.Add(value);
      var rows = rowList.ToArray(); string rowsKey = NativeApp.Json.Serialize(rows);
      if (rowsKey != lastRows) {
        lastRows = rowsKey; foreach (var element in activities.Children) { var previous = element as Button; if (previous != null) buttons.Remove(previous); } activities.Children.Clear(); activityButton.Content = rows == null || rows.Length == 0 ? "动态" : "动态 " + rows.Length;
        if (rows == null || rows.Length == 0) activities.Children.Add(new TextBlock { Text = "暂时没有需要关注的任务。", Foreground = fg, FontSize = 12, Margin = new Thickness(3, 5, 3, 5) });
        else foreach (var item in rows) { var task = item as Dictionary<string, object>; if (task == null) continue; string sessionId = Str(task, "id"); var button = MakeButton(Str(task, "title") + "\n" + Str(task, "label"), delegate { activity.IsOpen = false; OpenHarness(); NativeApp.Emit(new { type = "open-session", sessionId = sessionId }); }); button.Foreground = fg; button.Background = bg; button.HorizontalContentAlignment = HorizontalAlignment.Left; activities.Children.Add(button); }
      }
      bool desktop = Str(preferences, "surface", "desktop") == "desktop"; SetHotkey(desktop);
      if (desktop && Bool(preferences, "visible", true)) { if (!IsVisible) Show(); } else { chat.IsOpen = false; activity.IsOpen = false; Hide(); }
      var position = Get(preferences, "desktopPosition") as Dictionary<string, object>;
      string positionKey = NativeApp.Json.Serialize(position);
      if (firstPosition || (!dragging && positionKey != stateKey)) {
        stateKey = positionKey; firstPosition = false;
        Left = position == null ? SystemParameters.WorkArea.Right - Width - 32 : Num(position, "x", 200);
        Top = position == null ? SystemParameters.WorkArea.Bottom - sprite.Height - 78 : Num(position, "y", 200);
        ClampToScreen();
      }
      UpdateToolbar();
    }
    void Draw() { int index = row * 8 + column; if (index >= 0 && index < frames.Length) sprite.Source = frames[index]; }
  }
  static class BorderExtensions { public static void TextBlockForeground(this Border border, Brush brush) { TextElement.SetForeground(border, brush); } }
}
