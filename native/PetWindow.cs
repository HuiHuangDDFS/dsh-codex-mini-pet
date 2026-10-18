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
using System.Windows.Automation;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Effects;
using System.Windows.Media.Animation;
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
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int length);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int length);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    delegate bool WindowVisitor(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(WindowVisitor visitor, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    const int HotkeyId = 24071;
    readonly Image sprite = new Image();
    readonly StackPanel stack = new StackPanel();
    readonly Grid controls = new Grid();
    readonly TextBlock dragGrip = new TextBlock { Text = "⠿", Width = 24, Height = 36, TextAlignment = TextAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Padding = new Thickness(3, 6, 0, 0), FontSize = 17, Background = Brushes.Transparent, Cursor = Cursors.SizeAll, Visibility = Visibility.Collapsed };
    FrameworkElement dragSurface;
    readonly Border toolbar = new Border { CornerRadius = new CornerRadius(19), BorderThickness = new Thickness(.5), Padding = new Thickness(0), Margin = new Thickness(5, 2, 5, 6) };
    // Keep panels open without Popup's outside-click mouse capture so the pet
    // remains draggable. Their toolbar buttons, close buttons and Esc dismiss them.
    readonly Popup chat = new Popup { AllowsTransparency = true, StaysOpen = true, Placement = PlacementMode.Top };
    readonly Popup activity = new Popup { AllowsTransparency = true, StaysOpen = true, Placement = PlacementMode.Top };
    readonly TextBox prompt = new TextBox { AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 76, MaxHeight = 160, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Padding = new Thickness(8), FontSize = 13 };
    readonly TextBlock feedback = new TextBlock { TextWrapping = TextWrapping.Wrap, FontSize = 11, Margin = new Thickness(0, 8, 0, 0) };
    readonly ComboBox workspace = new ComboBox { FontSize = 12, Margin = new Thickness(0, 0, 0, 8), MinHeight = 30, SelectedValuePath = "Tag" };
    readonly ComboBox sessionTarget = new ComboBox { FontSize = 12, Margin = new Thickness(0, 0, 0, 2), MinHeight = 36, SelectedValuePath = "Tag" };
    readonly Popup completion = new Popup { AllowsTransparency = true, StaysOpen = true, Placement = PlacementMode.Custom, Focusable = false };
    readonly TextBlock completionTitle = new TextBlock { Text = "任务完成啦", FontSize = 13, FontWeight = FontWeights.SemiBold };
    readonly TextBlock completionDetail = new TextBlock { FontSize = 12, TextWrapping = TextWrapping.Wrap, MaxWidth = 200, Margin = new Thickness(0, 5, 0, 5) };
    readonly System.Windows.Shapes.Path completionTail = new System.Windows.Shapes.Path { Width = 14, Height = 8, Stretch = Stretch.Fill };
    readonly HashSet<string> seenCompletions = new HashSet<string>();
    readonly StackPanel activities = new StackPanel();
    readonly TextBlock statusText = new TextBlock { FontSize = 11, TextAlignment = TextAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(10, 0, 10, 4), Height = 18 };
    readonly Border statusPill = new Border { CornerRadius = new CornerRadius(9), HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(8, 0, 8, 4), BorderThickness = new Thickness(.5) };
    readonly TextBlock chatTitle = new TextBlock { Text = "聊一聊", FontSize = 17, FontWeight = FontWeights.SemiBold };
    readonly TextBlock chatSubtitle = new TextBlock { Text = "有个想法？随时告诉我。", FontSize = 11, Margin = new Thickness(0, 4, 0, 0) };
    readonly TextBlock placeholder = new TextBlock { Text = "此刻，你想一起做点什么？", IsHitTestVisible = false, FontSize = 13, Margin = new Thickness(12, 11, 12, 0) };
    readonly Border inputBorder = new Border { CornerRadius = new CornerRadius(12), BorderThickness = new Thickness(1), Margin = new Thickness(0, 10, 0, 0) };
    readonly TextBlock activitySummary = new TextBlock { FontSize = 11, Margin = new Thickness(0, 4, 0, 12) };
    readonly Button chatButton;
    readonly Button editButton;
    readonly Button sendButton;
    readonly Button activityButton;
    readonly List<Button> buttons = new List<Button>();
    readonly Dictionary<TextBlock, string> textSources = new Dictionary<TextBlock, string>();
    readonly Dictionary<Button, string> buttonSources = new Dictionary<Button, string>();
    readonly Dictionary<FrameworkElement, string> tooltipSources = new Dictionary<FrameworkElement, string>();
    Dictionary<string, object> messages = new Dictionary<string, object>();
    string language = "zh-CN", feedbackSource = "";
    readonly DispatcherTimer pointer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
    BitmapSource[] frames = new BitmapSource[0];
    Dictionary<string, object> preferences = new Dictionary<string, object>();
    Dictionary<string, object> context = new Dictionary<string, object>();
    string lastRows = "", currentName = "", stateKey = "", workspaceKey = "", sessionsKey = "", completionSessionId = "";
    bool toolbarShown, updatingTargets;
    DateTime lastNear, completionUntil;
    bool hotkey, mini, dragging, pointerDown, dark = true, firstPosition = true, pending;
    POINT dragStart, dragLast; double dragLeft, dragTop; string dragDirection = "right";
    int gaze = -2, row, column;
    DateTime pendingSince;
    IntPtr handle;
    public bool AllowExit;
    Brush bg = Brushes.White, fg = Brushes.Black, line = Brushes.Gray;
    Brush accent = Brushes.CornflowerBlue, muted = Brushes.Gray;
    string statusLabel = "随时准备好";
    DateTime statusUntil;

    static object Get(Dictionary<string, object> value, string key) { object result; return value != null && value.TryGetValue(key, out result) ? result : null; }
    static string Str(Dictionary<string, object> value, string key, string fallback = "") { var result = Get(value, key); return result == null ? fallback : Convert.ToString(result); }
    static bool Bool(Dictionary<string, object> value, string key, bool fallback = false) { var result = Get(value, key); return result is bool ? (bool)result : fallback; }
    static double Num(Dictionary<string, object> value, string key, double fallback) { try { var result = Get(value, key); return result == null ? fallback : Convert.ToDouble(result); } catch { return fallback; } }
    static Dictionary<string, object> Obj(Dictionary<string, object> value, string key) { return Get(value, key) as Dictionary<string, object> ?? new Dictionary<string, object>(); }
    Brush Color(string value) { return (Brush)new BrushConverter().ConvertFromString(value); }
    string T(string source) {
      if (language == "en") return Str(messages, source, source);
      if (!messages.ContainsKey(source)) foreach (var item in messages) if (Convert.ToString(item.Value) == source) return item.Key;
      return source;
    }
    TextBlock Localized(TextBlock text) { textSources[text] = text.Text; text.Text = T(text.Text); return text; }
    void SetFeedback(string source) { feedbackSource = source; feedback.Text = T(source); }
    void ApplyLanguage(Dictionary<string, object> value) {
      string next = Str(preferences, "language", "zh-CN");
      bool changed = next != language; language = next; messages = Obj(value, "messages");
      foreach (var item in textSources) item.Key.Text = T(item.Value);
      foreach (var item in buttonSources) {
        if (item.Key.Content is string) item.Key.Content = T(item.Value);
        AutomationProperties.SetName(item.Key, T(item.Value));
      }
      foreach (var item in tooltipSources) item.Key.ToolTip = T(item.Value);
      Title = T("DeepSeek Harness · 宠物伙伴"); feedback.Text = T(feedbackSource);
      AutomationProperties.SetName(workspace, T("快速聊天工作区"));
      AutomationProperties.SetName(sessionTarget, T("快速聊天会话"));
      if (changed) { lastRows = ""; BuildMenu(); StyleSelector(workspace); StyleSelector(sessionTarget); }
    }

    public PetWindow() {
      Title = "DeepSeek Harness · 宠物伙伴"; WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize;
      AllowsTransparency = true; Background = Brushes.Transparent; ShowInTaskbar = false; ShowActivated = false;
      Topmost = true; Width = 170; SizeToContent = SizeToContent.Height; Focusable = true;
      FontFamily = new FontFamily("Microsoft YaHei UI, Segoe UI");
      UseLayoutRounding = true; SnapsToDevicePixels = true;
      toolbar.Effect = new DropShadowEffect { BlurRadius = 10, ShadowDepth = 2, Opacity = .12, Color = Colors.Black };
      stack.Children.Add(sprite); statusText.Margin = new Thickness(8, 3, 8, 3); statusText.Height = Double.NaN; statusPill.Child = statusText; stack.Children.Add(statusPill);
      controls.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); controls.ColumnDefinitions.Add(new ColumnDefinition()); controls.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); controls.ColumnDefinitions.Add(new ColumnDefinition());
      controls.Children.Add(dragGrip); dragGrip.ToolTip = "拖动移动"; AutomationProperties.SetName(dragGrip, "拖动移动");
      chatButton = MakeToolbarButton("聊一聊", "M 3,2.5 L 13,2.5 Q 14,2.5 14,3.5 L 14,10 Q 14,11 13,11 L 7,11 L 3,14 L 3,11 Q 2,11 2,10 L 2,3.5 Q 2,2.5 3,2.5", delegate { ToggleChat(); }, new CornerRadius(18.5, 0, 0, 18.5));
      Grid.SetColumn(chatButton, 1); controls.Children.Add(chatButton);
      activityButton = MakeToolbarButton("动态", "M 2,4 L 4,4 M 7,4 L 14,4 M 2,8 L 4,8 M 7,8 L 14,8 M 2,12 L 4,12 M 7,12 L 14,12", delegate { ToggleActivity(); }, new CornerRadius(0, 18.5, 18.5, 0));
      var divider = new Border { Width = .5, Height = 14, Background = line, Name = "Divider", IsHitTestVisible = false }; Grid.SetColumn(divider, 2); controls.Children.Add(divider); Grid.SetColumn(activityButton, 3);
      controls.Children.Add(activityButton); toolbar.Child = controls; stack.Children.Add(toolbar); Content = stack;
      sprite.HorizontalAlignment = HorizontalAlignment.Center; sprite.Stretch = Stretch.Uniform;
      RenderOptions.SetBitmapScalingMode(sprite, BitmapScalingMode.HighQuality);
      toolbar.Opacity = 0; toolbar.IsHitTestVisible = false; toolbar.RenderTransform = new TranslateTransform(0, 6);
      foreach (var popup in new Popup[] { chat, activity }) { popup.PlacementTarget = this; popup.Placement = PlacementMode.Custom; popup.CustomPopupPlacementCallback = PlacePanel; }
      completion.PlacementTarget = this; completion.CustomPopupPlacementCallback = PlaceCompletion;
      chat.Opened += delegate {
        UpdateToolbar();
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(delegate { if (chat.IsOpen && !pointerDown) { prompt.Focus(); Keyboard.Focus(prompt); } }));
      };
      chat.Closed += delegate { UpdateToolbar(); };
      activity.Opened += delegate {
        // Viewing activity must not activate the pet or displace the app in use.
        var source = PresentationSource.FromVisual(activity.Child) as HwndSource;
        if (source != null) source.AddHook(PassivePopupHook);
        UpdateToolbar();
      };
      activity.Closed += delegate { UpdateToolbar(); };
      var chatPanel = new StackPanel();
      var titleRow = new DockPanel { Margin = new Thickness(0, 0, 0, 8) };
      var closeChat = MakeButton("×", delegate { chat.IsOpen = false; }); closeChat.ToolTip = "关闭聊天"; DockPanel.SetDock(closeChat, Dock.Right); titleRow.Children.Add(closeChat);
      var heading = new StackPanel(); heading.Children.Add(chatTitle); heading.Children.Add(chatSubtitle); titleRow.Children.Add(heading);
      chatPanel.Children.Add(titleRow);
      chatPanel.Children.Add(Localized(new TextBlock { Text = "新会话 · 工作区", FontSize = 10, Margin = new Thickness(0, 8, 0, 6) }));
      chatPanel.Children.Add(workspace);
      chatPanel.Children.Add(Localized(new TextBlock { Text = "会话", FontSize = 10, Margin = new Thickness(0, 0, 0, 6) }));
      chatPanel.Children.Add(sessionTarget);
      var inputLayer = new Grid(); inputLayer.Children.Add(prompt); inputLayer.Children.Add(placeholder); inputBorder.Child = inputLayer; chatPanel.Children.Add(inputBorder);
      chatPanel.Children.Add(Localized(new TextBlock { Text = "Enter 发送 · Shift+Enter 换行", FontSize = 10, Margin = new Thickness(2, 8, 0, 0) }));
      prompt.BorderThickness = new Thickness(0); prompt.Background = Brushes.Transparent; prompt.Padding = new Thickness(11); prompt.MinHeight = 94;
      prompt.TextChanged += delegate { placeholder.Visibility = String.IsNullOrEmpty(prompt.Text) ? Visibility.Visible : Visibility.Collapsed; UpdateChatActions(); };
      prompt.GotKeyboardFocus += delegate { inputBorder.BorderBrush = accent; };
      prompt.LostKeyboardFocus += delegate { inputBorder.BorderBrush = line; };
      var chatActions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 10, 0, 0) };
      sendButton = MakeButton("发送", delegate { SendPrompt(); }); sendButton.Tag = "primary"; sendButton.Margin = new Thickness(8, 0, 0, 0);
      chatPanel.Children.Add(chatActions); chatPanel.Children.Add(feedback); chat.Child = PopupBorder(chatPanel, 350);
      AutomationProperties.SetName(workspace, "快速聊天工作区");
      AutomationProperties.SetName(sessionTarget, "快速聊天会话");
      StyleSelector(workspace); StyleSelector(sessionTarget);
      workspace.SelectionChanged += delegate { if (!updatingTargets) { sessionsKey = ""; UpdateSessionTargets(); } UpdateChatActions(); };
      sessionTarget.SelectionChanged += delegate { UpdateChatActions(); };
      editButton = MakeButton("在主会话编辑", delegate { BeginChat("edit-chat"); }); chatActions.Children.Add(editButton);
      chatActions.Children.Add(sendButton);
      var activityPanel = new StackPanel(); var activityHeading = new DockPanel();
      var closeActivity = MakeButton("×", delegate { activity.IsOpen = false; }); closeActivity.Focusable = false; closeActivity.ToolTip = "关闭动态"; DockPanel.SetDock(closeActivity, Dock.Right); activityHeading.Children.Add(closeActivity);
      activityHeading.Children.Add(Localized(new TextBlock { Text = "任务动态", FontSize = 17, FontWeight = FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center }));
      activityPanel.Children.Add(activityHeading); activityPanel.Children.Add(activitySummary);
      activityPanel.Children.Add(new ScrollViewer { Content = activities, MaxHeight = 340, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
      activity.Child = PopupBorder(activityPanel, 350);
      var noticePanel = new StackPanel(); var noticeHeading = new DockPanel();
      var closeNotice = MakeButton("×", delegate { completion.IsOpen = false; }); closeNotice.ToolTip = "关闭完成提醒"; DockPanel.SetDock(closeNotice, Dock.Right); noticeHeading.Children.Add(closeNotice); noticeHeading.Children.Add(completionTitle);
      noticePanel.Children.Add(noticeHeading);
      var openResult = MakeButton("查看完成的任务", delegate { completion.IsOpen = false; OpenHarness(); NativeApp.Emit(new { type = "open-session", sessionId = completionSessionId }); });
      var noticeContent = new StackPanel(); noticeContent.Children.Add(completionDetail); noticeContent.Children.Add(Localized(new TextBlock { Text = "查看结果  ›", FontSize = 10 })); openResult.Content = noticeContent; openResult.HorizontalContentAlignment = HorizontalAlignment.Left; noticePanel.Children.Add(openResult);
      var noticeBody = PopupBorder(noticePanel, 250); noticeBody.Padding = new Thickness(12); noticeBody.CornerRadius = new CornerRadius(15); noticeBody.Margin = new Thickness(10, 10, 10, 0);
      var speech = new StackPanel(); speech.Children.Add(noticeBody); completionTail.Margin = new Thickness(24, 0, 24, 9); speech.Children.Add(completionTail); completion.Child = speech;
      prompt.PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
        if (e.Key == Key.Escape) { chat.IsOpen = false; e.Handled = true; return; }
        if (e.Key == Key.Enter && (Keyboard.Modifiers & ModifierKeys.Shift) == 0) { e.Handled = true; SendPrompt(); }
      };
      activityPanel.PreviewKeyDown += delegate(object sender, KeyEventArgs e) { if (e.Key == Key.Escape) { activity.IsOpen = false; e.Handled = true; } };
      sprite.Cursor = Cursors.Hand;
      AttachDrag(sprite); AttachDrag(dragGrip);
      LocationChanged += delegate { RepositionPopups(); };
      SizeChanged += delegate { RepositionPopups(); };
      MouseEnter += delegate { UpdateToolbar(); NativeApp.Emit(new { type = "hover", value = true }); };
      MouseLeave += delegate { UpdateToolbar(); NativeApp.Emit(new { type = "hover", value = false }); };
      Deactivated += delegate {
        if (Str(preferences, "visibilityBehavior") == "on-demand" && !activity.IsOpen && !chat.IsOpen) {
          Hide(); NativeApp.Emit(new { type = "preferences", patch = new { visible = false } });
        }
      };
      Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e) {
        if (!AllowExit) { e.Cancel = true; Hide(); NativeApp.Emit(new { type = "preferences", patch = new { visible = false } }); }
      };
      Closed += delegate { pointer.Stop(); completion.IsOpen = false; chat.IsOpen = false; activity.IsOpen = false; if (hotkey) UnregisterHotKey(handle, HotkeyId); };
      SourceInitialized += delegate {
        handle = new WindowInteropHelper(this).Handle; HwndSource.FromHwnd(handle).AddHook(Hook);
        NativeApp.Emit(new { type = "ready", hwnd = handle.ToInt64(), pid = Process.GetCurrentProcess().Id });
      };
      pointer.Tick += delegate { ObservePointer(); }; pointer.Start();
      Localized(chatSubtitle); Localized(placeholder); Localized(completionTitle);
      chatSubtitle.TextWrapping = TextWrapping.Wrap;
      foreach (var button in buttons) if (button.ToolTip is string) tooltipSources[button] = (string)button.ToolTip;
      ApplyTheme(new Dictionary<string, object>()); BuildMenu();
    }
    void AttachDrag(FrameworkElement surface) {
      surface.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e) {
        if (!GetCursorPos(out dragStart)) return;
        pointerDown = true; dragging = false; dragLast = dragStart; dragLeft = Left; dragTop = Top;
        dragSurface = surface; surface.CaptureMouse(); e.Handled = true;
      };
      surface.MouseMove += delegate(object sender, MouseEventArgs e) {
        if (!pointerDown) return;
        if (e.LeftButton != MouseButtonState.Pressed) { FinishDrag(); return; }
        POINT current; if (!GetCursorPos(out current)) return;
        var transform = PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice;
        var delta = transform.Transform(new Vector(current.X - dragStart.X, current.Y - dragStart.Y));
        if (!dragging && Math.Abs(delta.X) + Math.Abs(delta.Y) < 4) return;
        string direction = current.X < dragLast.X ? "left" : current.X > dragLast.X ? "right" : dragDirection;
        if (!dragging || direction != dragDirection) { dragDirection = direction; NativeApp.Emit(new { type = "drag", active = true, direction = direction }); }
        dragging = true; surface.Cursor = Cursors.SizeAll; dragLast = current;
        Left = dragLeft + delta.X; Top = dragTop + delta.Y; e.Handled = true;
      };
      surface.MouseLeftButtonUp += delegate(object sender, MouseButtonEventArgs e) { if (pointerDown) { FinishDrag(); e.Handled = true; } };
      surface.LostMouseCapture += delegate { if (pointerDown) FinishDrag(); };
    }
    void FinishDrag() {
      bool moved = dragging; pointerDown = false; dragging = false;
      var surface = dragSurface; dragSurface = null;
      if (surface != null) { surface.ReleaseMouseCapture(); surface.Cursor = surface == sprite ? Cursors.Hand : Cursors.SizeAll; }
      if (moved) { ClampToScreen(); NativeApp.Emit(new { type = "drag", active = false, direction = dragDirection }); NativeApp.Emit(new { type = "position", x = Left, y = Top }); }
      else if (surface == sprite) { statusText.Text = T("我在，随时陪你一起。"); statusUntil = DateTime.UtcNow.AddSeconds(3); NativeApp.Emit(new { type = "greet" }); }
    }
    Button MakeButton(string label, Action action, CornerRadius? corners = null) {
      var border = new FrameworkElementFactory(typeof(Border)); border.SetValue(Border.CornerRadiusProperty, corners ?? new CornerRadius(8));
      border.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
      border.SetValue(TextElement.ForegroundProperty, new TemplateBindingExtension(Control.ForegroundProperty));
      var content = new FrameworkElementFactory(typeof(ContentPresenter));
      content.SetValue(ContentPresenter.ContentProperty, new TemplateBindingExtension(ContentControl.ContentProperty));
      content.SetValue(ContentPresenter.ContentTemplateProperty, new TemplateBindingExtension(ContentControl.ContentTemplateProperty));
      content.SetValue(FrameworkElement.MarginProperty, new Thickness(9, 5, 9, 5));
      content.SetValue(FrameworkElement.HorizontalAlignmentProperty, new TemplateBindingExtension(Control.HorizontalContentAlignmentProperty)); content.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
      border.AppendChild(content);
      var button = new Button { Content = label, FontSize = 12, BorderThickness = new Thickness(0), Cursor = Cursors.Hand, MinHeight = 32, HorizontalContentAlignment = HorizontalAlignment.Center, RenderTransform = new TranslateTransform(), Template = new ControlTemplate(typeof(Button)) { VisualTree = border } };
      if (!label.Contains("\n")) buttonSources[button] = label;
      AutomationProperties.SetName(button, label);
      button.MouseEnter += delegate { PaintButton(button, true); Lift(button, -1.5); }; button.MouseLeave += delegate { PaintButton(button, false); Lift(button, 0); };
      button.IsEnabledChanged += delegate { button.Opacity = button.IsEnabled ? 1 : .45; };
      button.Click += delegate { action(); }; buttons.Add(button); return button;
    }
    Button MakeToolbarButton(string label, string geometry, Action action, CornerRadius corners) {
      var button = MakeButton(label, action, corners); button.MinHeight = 36; button.Focusable = false;
      var panel = new StackPanel { Orientation = Orientation.Horizontal };
      var icon = new System.Windows.Shapes.Path { Data = Geometry.Parse(geometry), Width = 16, Height = 16, Stretch = Stretch.None, StrokeThickness = 1.3, StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, Margin = new Thickness(0, 0, 5, 0), VerticalAlignment = VerticalAlignment.Center };
      icon.SetBinding(System.Windows.Shapes.Shape.StrokeProperty, new System.Windows.Data.Binding("Foreground") { Source = button });
      panel.Children.Add(icon); panel.Children.Add(Localized(new TextBlock { Text = label, VerticalAlignment = VerticalAlignment.Center })); button.Content = panel;
      return button;
    }
    void PaintButton(Button button, bool hover) {
      bool primary = Convert.ToString(button.Tag) == "primary";
      bool selected = (button == chatButton && chat.IsOpen) || (button == activityButton && activity.IsOpen);
      button.Background = primary ? accent : selected ? Color(dark ? "#283C4D" : "#EAF4FF") : hover ? Color(dark ? "#34363C" : "#F0F4FA") : Brushes.Transparent;
      button.Foreground = primary ? Color("#FFFFFF") : selected ? accent : fg;
    }
    void Lift(Button button, double y) {
      // Segment backgrounds must stay flush with the surrounding capsule.
      if (button == chatButton || button == activityButton) return;
      var transform = button.RenderTransform as TranslateTransform; if (transform == null) return;
      if (Bool(preferences, "reducedMotion")) { transform.BeginAnimation(TranslateTransform.YProperty, null); transform.Y = 0; return; }
      transform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(y, TimeSpan.FromMilliseconds(140)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
    }
    void StyleSelector(ComboBox selector) {
      selector.MinHeight = 38;
      selector.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse(@"
<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='{x:Type ComboBox}'>
 <Grid>
  <ToggleButton Focusable='False' Foreground='{TemplateBinding Foreground}' IsChecked='{Binding IsDropDownOpen, RelativeSource={RelativeSource TemplatedParent}, Mode=TwoWay}' ClickMode='Press'>
   <ToggleButton.Template><ControlTemplate TargetType='{x:Type ToggleButton}'>
    <Border x:Name='Surface' Background='{Binding Background, RelativeSource={RelativeSource AncestorType=ComboBox}}' BorderBrush='{Binding BorderBrush, RelativeSource={RelativeSource AncestorType=ComboBox}}' BorderThickness='1' CornerRadius='10'>
     <Grid Margin='11,8'><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width='18'/></Grid.ColumnDefinitions>
      <ContentPresenter TextElement.Foreground='{Binding Foreground, RelativeSource={RelativeSource AncestorType=ComboBox}}' Content='{Binding SelectionBoxItem, RelativeSource={RelativeSource AncestorType=ComboBox}}' ContentTemplate='{Binding SelectionBoxItemTemplate, RelativeSource={RelativeSource AncestorType=ComboBox}}' VerticalAlignment='Center' IsHitTestVisible='False'/>
      <Path Grid.Column='1' Data='M 2,4 L 6,8 L 10,4' Stroke='{Binding Foreground, RelativeSource={RelativeSource AncestorType=ComboBox}}' StrokeThickness='1.4' VerticalAlignment='Center' HorizontalAlignment='Right'/>
     </Grid>
    </Border>
    <ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Surface' Property='BorderBrush' Value='#719CD8'/></Trigger></ControlTemplate.Triggers>
   </ControlTemplate></ToggleButton.Template>
  </ToggleButton>
  <TextBlock x:Name='Hint' Text='" + T("请选择") + @"' Margin='12,0,32,0' VerticalAlignment='Center' IsHitTestVisible='False' Visibility='Collapsed' Foreground='{TemplateBinding Foreground}'/>
  <Popup x:Name='PART_Popup' IsOpen='{TemplateBinding IsDropDownOpen}' AllowsTransparency='True' Focusable='False' Placement='Bottom' VerticalOffset='5'>
   <Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='1' CornerRadius='12' Padding='5' MinWidth='{TemplateBinding ActualWidth}'>
    <ScrollViewer MaxHeight='230' CanContentScroll='True' HorizontalScrollBarVisibility='Disabled' VerticalScrollBarVisibility='Auto'><ItemsPresenter KeyboardNavigation.DirectionalNavigation='Contained'/></ScrollViewer>
   </Border>
  </Popup>
 </Grid>
 <ControlTemplate.Triggers><Trigger Property='SelectedIndex' Value='-1'><Setter TargetName='Hint' Property='Visibility' Value='Visible'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter Property='Opacity' Value='.5'/></Trigger><Trigger Property='IsKeyboardFocusWithin' Value='True'><Setter Property='BorderBrush' Value='#719CD8'/></Trigger></ControlTemplate.Triggers>
</ControlTemplate>");
      selector.ItemContainerStyle = (Style)System.Windows.Markup.XamlReader.Parse(@"
<Style xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='{x:Type ComboBoxItem}'>
 <Setter Property='HorizontalContentAlignment' Value='Stretch'/><Setter Property='Margin' Value='0,1'/>
 <Setter Property='Template'><Setter.Value><ControlTemplate TargetType='{x:Type ComboBoxItem}'>
  <Border x:Name='Row' Padding='10,9' CornerRadius='8' Background='Transparent' TextElement.Foreground='{TemplateBinding Foreground}'>
   <Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width='22'/></Grid.ColumnDefinitions><ContentPresenter/><TextBlock x:Name='Check' Grid.Column='1' Text='✓' Foreground='#719CD8' Visibility='Hidden' HorizontalAlignment='Right'/></Grid>
  </Border>
  <ControlTemplate.Triggers><Trigger Property='IsHighlighted' Value='True'><Setter TargetName='Row' Property='Background' Value='#224A83CE'/></Trigger><Trigger Property='IsSelected' Value='True'><Setter TargetName='Row' Property='Background' Value='#224A83CE'/><Setter TargetName='Check' Property='Visibility' Value='Visible'/></Trigger></ControlTemplate.Triggers>
 </ControlTemplate></Setter.Value></Setter>
</Style>");
    }
    Rect WorkArea() {
      var center = PointToScreen(new Point(ActualWidth / 2, ActualHeight / 2));
      var screen = System.Windows.Forms.Screen.FromPoint(new System.Drawing.Point((int)center.X, (int)center.Y));
      var transform = PresentationSource.FromVisual(this).CompositionTarget.TransformFromDevice;
      return new Rect(transform.Transform(new Point(screen.WorkingArea.Left, screen.WorkingArea.Top)), transform.Transform(new Point(screen.WorkingArea.Right, screen.WorkingArea.Bottom)));
    }
    bool InwardRight() { var area = WorkArea(); return Left + ActualWidth / 2 < area.Left + area.Width / 2; }
    void RepositionPopups() {
      // WPF Popup owns a separate native window and does not follow its target's
      // movement. Changing the offset re-runs custom placement without reopening
      // the panel, resetting its draft, or changing keyboard focus.
      foreach (var popup in new Popup[] { chat, activity, completion }) {
        if (!popup.IsOpen) continue;
        double offset = popup.HorizontalOffset;
        popup.SetCurrentValue(Popup.HorizontalOffsetProperty, offset + 1);
        popup.SetCurrentValue(Popup.HorizontalOffsetProperty, offset);
      }
    }
    CustomPopupPlacement[] PlacePanel(Size popup, Size target, Point offset) {
      var area = WorkArea(); bool right = InwardRight();
      double y = Math.Max(area.Top - Top, Math.Min(-24, area.Bottom - Top - popup.Height));
      return new CustomPopupPlacement[] { new CustomPopupPlacement(new Point(right ? target.Width + 8 : -popup.Width - 8, y), PopupPrimaryAxis.Vertical), new CustomPopupPlacement(new Point(right ? -popup.Width - 8 : target.Width + 8, y), PopupPrimaryAxis.Vertical) };
    }
    CustomPopupPlacement[] PlaceCompletion(Size popup, Size target, Point offset) {
      var area = WorkArea(); bool right = InwardRight();
      completionTail.HorizontalAlignment = right ? HorizontalAlignment.Left : HorizontalAlignment.Right;
      completionTail.Data = Geometry.Parse(right ? "M 0,0 L 14,0 L 0,8 Z" : "M 0,0 L 14,0 L 14,8 Z");
      double y = Math.Max(area.Top - Top, Math.Min(24 - popup.Height, area.Bottom - Top - popup.Height));
      return new CustomPopupPlacement[] { new CustomPopupPlacement(new Point(right ? target.Width - 16 : -popup.Width + 16, y), PopupPrimaryAxis.Vertical) };
    }
    Border PopupBorder(UIElement child, double width) { return new Border { Child = child, Width = width, Padding = new Thickness(18), CornerRadius = new CornerRadius(20), BorderThickness = new Thickness(.5), Margin = new Thickness(12), Effect = new DropShadowEffect { BlurRadius = 18, ShadowDepth = 4, Opacity = .18, Color = Colors.Black } }; }
    void ApplyTheme(Dictionary<string, object> theme) {
      dark = Bool(theme, "dark", true); bg = Color(dark ? "#24272D" : "#FFFFFF"); fg = Color(dark ? "#EDF1F7" : "#202C40"); line = Color(dark ? "#404650" : "#DEE6F0");
      accent = Color(dark ? "#669FE8" : "#4279C9"); muted = Color(dark ? "#A4B1C3" : "#6C7B91");
      toolbar.Background = bg; toolbar.BorderBrush = line; dragGrip.Foreground = muted;
      statusPill.Background = bg; statusPill.BorderBrush = line;
      foreach (var button in buttons) PaintButton(button, button.IsMouseOver);
      foreach (var element in controls.Children) { var divider = element as Border; if (divider != null) divider.Background = line; }
      foreach (var popup in new Popup[] { chat, activity }) { var border = (Border)popup.Child; border.Background = bg; border.BorderBrush = line; border.TextBlockForeground(fg); }
      inputBorder.Background = Color(dark ? "#1C2026" : "#F6F8FC"); inputBorder.BorderBrush = prompt.IsKeyboardFocused ? accent : line;
      prompt.Foreground = fg; prompt.CaretBrush = accent;
      foreach (var selector in new ComboBox[] { workspace, sessionTarget }) {
        selector.Foreground = fg; selector.Background = Color(dark ? "#1C2026" : "#F6F8FC"); selector.BorderBrush = line;
        foreach (ComboBoxItem item in selector.Items) item.Foreground = fg;
      }
      if (completion.Child != null) { var speech = (StackPanel)completion.Child; var body = (Border)speech.Children[0]; body.Background = bg; body.BorderBrush = line; body.TextBlockForeground(fg); completionTail.Fill = bg; }
      feedback.Foreground = muted; placeholder.Foreground = muted; statusText.Foreground = muted; chatSubtitle.Foreground = muted; activitySummary.Foreground = muted;
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
    void AddMenu(ContextMenu menu, string title, Action action) { var item = new MenuItem { Header = T(title) }; item.Click += delegate { action(); }; menu.Items.Add(item); }
    IntPtr Hook(IntPtr hwnd, int message, IntPtr w, IntPtr l, ref bool handled) {
      if (message == 0x312 && w.ToInt32() == HotkeyId) {
        handled = true; if (!IsVisible) Show(); NativeApp.Emit(new { type = "preferences", patch = new { visible = true } }); ToggleChat();
      }
      // The toolbar never activates implicitly; chat explicitly activates for typing.
      if (message == 0x21) { handled = true; return new IntPtr(3); }
      return IntPtr.Zero;
    }
    IntPtr PassivePopupHook(IntPtr hwnd, int message, IntPtr w, IntPtr l, ref bool handled) {
      if (message == 0x21) { handled = true; return new IntPtr(3); }
      return IntPtr.Zero;
    }
    void SetHotkey(bool enabled) {
      if (enabled && !hotkey) hotkey = RegisterHotKey(handle, HotkeyId, 1 | 2 | 4 | 0x4000, 0x50);
      if (!enabled && hotkey) { UnregisterHotKey(handle, HotkeyId); hotkey = false; }
      NativeApp.Emit(new { type = "hotkey", registered = hotkey });
    }
    void ToggleChat() {
      activity.IsOpen = false; chat.IsOpen = !chat.IsOpen;
      if (chat.IsOpen) { Activate(); }
    }
    void ToggleActivity() {
      chat.IsOpen = false; activity.IsOpen = !activity.IsOpen;
    }
    void UpdateChatActions() {
      if (sendButton == null || editButton == null) return;
      bool chosen = !String.IsNullOrEmpty(Convert.ToString(workspace.SelectedValue));
      prompt.IsReadOnly = pending;
      sendButton.IsEnabled = !pending && chosen && !String.IsNullOrWhiteSpace(prompt.Text);
      editButton.IsEnabled = !pending && chosen;
    }
    void UpdateWorkspaces() {
      var incoming = Get(context, "workspaces") as IEnumerable;
      string key = NativeApp.Json.Serialize(incoming) + ":" + language;
      if (key == workspaceKey) { UpdateSessionTargets(); return; }
      workspaceKey = key;
      string selected = Convert.ToString(workspace.SelectedValue);
      updatingTargets = true;
      workspace.Items.Clear();
      if (incoming != null) foreach (var value in incoming) {
        var item = value as Dictionary<string, object>; if (item == null) continue;
        string path = Str(item, "path"); string name = System.IO.Path.GetFileName(path.TrimEnd('\\', '/'));
        workspace.Items.Add(new ComboBoxItem { Content = Str(item, "title", String.IsNullOrEmpty(name) ? path : name), ToolTip = path, Tag = Str(item, "workspaceId"), Foreground = fg });
      }
      workspace.SelectedValue = selected;
      if (workspace.SelectedIndex < 0) workspace.SelectedValue = Str(context, "currentWorkspaceId");
      updatingTargets = false;
      workspace.ToolTip = T(workspace.Items.Count == 0 ? "请先在 Harness 中添加工作区" : "选择新会话的工作区");
      UpdateSessionTargets();
      UpdateChatActions();
    }
    void UpdateSessionTargets() {
      string selectedWorkspace = Convert.ToString(workspace.SelectedValue);
      var incoming = Get(context, "sessions") as IEnumerable;
      string key = selectedWorkspace + ":" + NativeApp.Json.Serialize(incoming) + ":" + language;
      if (key == sessionsKey) return;
      bool sameWorkspace = sessionsKey.StartsWith(selectedWorkspace + ":", StringComparison.Ordinal);
      string selected = sameWorkspace ? Convert.ToString(sessionTarget.SelectedValue) : "new";
      sessionsKey = key; sessionTarget.Items.Clear();
      sessionTarget.Items.Add(new ComboBoxItem { Content = T("+ 新会话"), Tag = "new", Foreground = fg });
      if (incoming != null) foreach (var value in incoming) {
        var item = value as Dictionary<string, object>; if (item == null || Str(item, "workspaceId") != selectedWorkspace) continue;
        sessionTarget.Items.Add(new ComboBoxItem { Content = Str(item, "title", "未命名会话"), Tag = Str(item, "sessionId"), Foreground = fg, ToolTip = Str(item, "title") });
      }
      sessionTarget.SelectedValue = selected;
      if (sessionTarget.SelectedIndex < 0) sessionTarget.SelectedValue = "new";
      sessionTarget.ToolTip = T("选择未归档会话，或开始新会话");
    }
    void SendPrompt() {
      if (pending || String.IsNullOrWhiteSpace(prompt.Text)) return;
      BeginChat("send-chat");
    }
    void BeginChat(string kind) {
      if (pending) return;
      string selected = Convert.ToString(workspace.SelectedValue);
      if (String.IsNullOrEmpty(selected)) { SetFeedback("请先选择工作区。"); workspace.Focus(); return; }
      pending = true; pendingSince = DateTime.UtcNow; sendButton.IsEnabled = false; workspace.IsEnabled = false; sessionTarget.IsEnabled = false;
      UpdateChatActions();
      SetFeedback(kind == "edit-chat" ? "正在打开主会话…" : "正在发送…");
      // Sending stays in the background; only an explicit composer transfer opens Harness.
      if (kind == "edit-chat") OpenHarness();
      string target = Convert.ToString(sessionTarget.SelectedValue);
      NativeApp.Emit(new { type = kind, text = prompt.Text, workspaceId = selected, sessionId = target == "new" || String.IsNullOrEmpty(target) ? null : target });
    }
    static string WindowText(IntPtr window) { var text = new StringBuilder(512); GetWindowText(window, text, text.Capacity); return text.ToString(); }
    IntPtr FindHarnessWindow() {
      int pid; if (!Int32.TryParse(Environment.GetEnvironmentVariable("DSH_PET_OWNER_PID"), out pid) || pid <= 0) return IntPtr.Zero;
      IntPtr window = IntPtr.Zero; long largest = -1;
      // A tray-hidden BrowserWindow is still the main window. Visibility and
      // MainWindowHandle cannot identify it; Electron utility windows are excluded.
      EnumWindows(delegate(IntPtr candidate, IntPtr data) {
        uint owner; GetWindowThreadProcessId(candidate, out owner);
        if (owner != (uint)pid || !WindowText(candidate).EndsWith("DeepSeek Harness", StringComparison.OrdinalIgnoreCase)) return true;
        var className = new StringBuilder(256); GetClassName(candidate, className, className.Capacity);
        if (className.ToString() != "Chrome_WidgetWin_1") return true;
        RECT rect; long area = GetWindowRect(candidate, out rect) ? Math.Max(0L, (long)(rect.Right - rect.Left) * (rect.Bottom - rect.Top)) : 0;
        if (area > largest) { largest = area; window = candidate; }
        return true;
      }, IntPtr.Zero);
      return window;
    }
    void OpenHarness() {
      try {
        IntPtr window = FindHarnessWindow(); if (window == IntPtr.Zero) return;
        chat.IsOpen = false; activity.IsOpen = false;
        // Let WPF release popup capture/focus before handing activation to Harness.
        Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(delegate {
          if (IsIconic(window)) ShowWindow(window, 9);
          else if (!IsWindowVisible(window)) {
            // Electron also tracks tray-hidden state internally. Its single-instance
            // activation restores that state; native ShowWindow alone does not.
            int pid; if (Int32.TryParse(Environment.GetEnvironmentVariable("DSH_PET_OWNER_PID"), out pid)) {
              try { Process.Start(new ProcessStartInfo(Process.GetProcessById(pid).MainModule.FileName) { UseShellExecute = false }); } catch { ShowWindow(window, 5); }
            }
          }
          SetForegroundWindow(window);
        }));
      } catch { }
    }
    void UpdateToolbar() {
      bool near = mini || dragging || chat.IsOpen || activity.IsOpen;
      POINT point;
      if (IsVisible && GetCursorPos(out point)) {
        var topLeft = PointToScreen(new Point(0, 0)); var bottomRight = PointToScreen(new Point(ActualWidth, ActualHeight));
        double margin = toolbarShown ? 65 : 38;
        near |= point.X >= topLeft.X - margin && point.X <= bottomRight.X + margin && point.Y >= topLeft.Y - margin && point.Y <= bottomRight.Y + margin;
      }
      if (near) lastNear = DateTime.UtcNow;
      bool show = near || (DateTime.UtcNow - lastNear).TotalMilliseconds < 550;
      if (show != toolbarShown) {
        toolbarShown = show; toolbar.IsHitTestVisible = show;
        var transform = (TranslateTransform)toolbar.RenderTransform;
        if (Bool(preferences, "reducedMotion")) { toolbar.BeginAnimation(OpacityProperty, null); transform.BeginAnimation(TranslateTransform.YProperty, null); toolbar.Opacity = show ? 1 : 0; transform.Y = show ? 0 : 6; }
        else {
          toolbar.BeginAnimation(OpacityProperty, new DoubleAnimation(show ? 1 : 0, TimeSpan.FromMilliseconds(180)));
          transform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(show ? 0 : 6, TimeSpan.FromMilliseconds(180)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
        }
      }
      PaintButton(chatButton, chatButton.IsMouseOver); PaintButton(activityButton, activityButton.IsMouseOver);
      statusPill.Visibility = mini ? Visibility.Collapsed : Visibility.Visible;
      statusPill.Opacity = IsMouseOver || DateTime.UtcNow < statusUntil || statusLabel != "随时准备好" ? 1 : .88;
      if (DateTime.UtcNow >= statusUntil) statusText.Text = T(statusLabel);
      if (completion.IsOpen && DateTime.UtcNow >= completionUntil) completion.IsOpen = false;
    }
    void ObservePointer() {
      UpdateToolbar(); if (!IsVisible || dragging) return;
      POINT point; if (!GetCursorPos(out point)) return;
      var center = PointToScreen(new Point(ActualWidth / 2, sprite.ActualHeight * .4));
      double dx = point.X - center.X, dy = point.Y - center.Y;
      int direction = Math.Sqrt(dx * dx + dy * dy) < 30 ? -1 : ((int)Math.Round((Math.Atan2(dx, -dy) * 180 / Math.PI + 360) % 360 / 22.5)) % 16;
      if (gaze != direction) { gaze = direction; NativeApp.Emit(new { type = "gaze", direction = direction }); }
      if (pending && (DateTime.UtcNow - pendingSince).TotalSeconds > 25) { pending = false; workspace.IsEnabled = true; sessionTarget.IsEnabled = true; UpdateChatActions(); SetFeedback("Harness 暂未响应，请打开主窗口检查。"); }
    }
    void ShowCompletions(Dictionary<string, object> message) {
      var incoming = Get(message, "completions") as IEnumerable; if (incoming == null) return;
      foreach (var value in incoming) {
        var notice = value as Dictionary<string, object>; if (notice == null) continue;
        string id = Str(notice, "id");
        if (String.IsNullOrEmpty(id) || seenCompletions.Contains(id)) continue;
        if (seenCompletions.Count > 100) seenCompletions.Clear(); seenCompletions.Add(id);
        double now = (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
        if (!IsVisible || Num(notice, "expiresAt", 0) < now) continue;
        completionSessionId = Str(notice, "sessionId"); completionDetail.Text = Str(notice, "title", "任务已完成");
        completionUntil = DateTime.UtcNow.AddSeconds(8);
        completion.PopupAnimation = Bool(preferences, "reducedMotion") ? PopupAnimation.None : PopupAnimation.Fade;
        completion.IsOpen = false; completion.IsOpen = true;
      }
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
    object BoundsOf(FrameworkElement element) {
      if (!element.IsVisible || element.ActualWidth <= 0) return null;
      var a = element.PointToScreen(new Point(0, 0)); var b = element.PointToScreen(new Point(element.ActualWidth, element.ActualHeight));
      return new { x = a.X, y = a.Y, width = b.X - a.X, height = b.Y - a.Y };
    }
    static string RenderedText(DependencyObject element) {
      var text = element as TextBlock; if (text != null) return text.Text;
      var value = new StringBuilder();
      for (int i = 0; i < VisualTreeHelper.GetChildrenCount(element); i++) value.Append(RenderedText(VisualTreeHelper.GetChild(element, i)));
      return value.ToString();
    }
    static void Capture(FrameworkElement element, string path) {
      if (String.IsNullOrEmpty(path) || !element.IsVisible) return;
      var bitmap = new RenderTargetBitmap((int)Math.Ceiling(element.ActualWidth), (int)Math.Ceiling(element.ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(element);
      var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap)); using (var output = File.Create(path)) encoder.Save(output);
    }
    public static BitmapSource[] CreateAtlasFrames(BitmapSource image) {
      int pixelScale = image.PixelWidth / (192 * 8);
      if ((pixelScale != 1 && pixelScale != 2) || image.PixelWidth != 192 * 8 * pixelScale || (image.PixelHeight != 208 * 9 * pixelScale && image.PixelHeight != 208 * 11 * pixelScale)) throw new ArgumentException("Atlas must be a complete 1x or 2x v1/v2 sprite sheet.");
      int cellWidth = 192 * pixelScale, cellHeight = 208 * pixelScale, rows = image.PixelHeight / cellHeight;
      var result = new BitmapSource[rows * 8];
      for (int r = 0; r < rows; r++) for (int c = 0; c < 8; c++) { var crop = new CroppedBitmap(image, new Int32Rect(c * cellWidth, r * cellHeight, cellWidth, cellHeight)); crop.Freeze(); result[r * 8 + c] = crop; }
      return result;
    }
    public void Accept(Dictionary<string, object> message) {
      string type = Str(message, "type");
      if (type == "toggle-chat") { if (!IsVisible) Show(); ToggleChat(); return; }
      if (type == "atlas") {
        var bytes = Convert.FromBase64String(Str(message, "base64")); var image = new BitmapImage();
        using (var stream = new MemoryStream(bytes)) { image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit(); image.Freeze(); }
        frames = CreateAtlasFrames(image);
        Draw(); return;
      }
      if (type == "frame") { row = (int)Num(message, "row", 0); column = (int)Num(message, "column", 0); Draw(); return; }
      if (type == "reply") {
        if (Str(message, "kind") != "send-chat" && Str(message, "kind") != "edit-chat") return;
        pending = false; workspace.IsEnabled = true; sessionTarget.IsEnabled = true;
        if (Bool(message, "ok")) { prompt.Clear(); SetFeedback(Str(message, "message", "已发送到 Harness")); } else SetFeedback(Str(message, "error", "发送失败，请在主会话中重试。"));
        feedback.Foreground = Bool(message, "ok") ? Color(dark ? "#91CEB4" : "#287D5B") : Color(dark ? "#FFADAD" : "#BC4C55");
        UpdateChatActions();
        if (!Bool(message, "ok")) { chat.IsOpen = true; Activate(); prompt.Focus(); }
        return;
      }
      if (type == "inspect") {
        IntPtr harness = FindHarnessWindow(); bool minimized = harness != IntPtr.Zero && IsIconic(harness);
        UpdateLayout(); Capture(this, Str(message, "capturePath")); Capture(chat.Child as FrameworkElement, Str(message, "captureChatPath"));
        var labels = new List<object>(); foreach (var button in buttons) labels.Add(new { label = AutomationProperties.GetName(button), text = RenderedText(button), visible = button.IsVisible, bounds = BoundsOf(button) });
        NativeApp.Emit(new { type = "inspection", visible = IsVisible, topmost = Topmost, extendedStyle = GetWindowLongPtr(handle, -20).ToInt64(), ownerMinimized = minimized, harnessWindow = harness.ToInt64(), harnessVisible = harness != IntPtr.Zero && IsWindowVisible(harness), foregroundWindow = GetForegroundWindow().ToInt64(), left = Left, top = Top, name = currentName, frameCount = frames.Length, chatOpen = chat.IsOpen, chatBounds = BoundsOf(chat.Child as FrameworkElement), inputFocused = prompt.IsKeyboardFocused, workspaceCount = workspace.Items.Count, workspaceId = workspace.SelectedValue, workspaceBounds = BoundsOf(workspace), sessionCount = sessionTarget.Items.Count, sessionId = sessionTarget.SelectedValue, completionOpen = completion.IsOpen, completionBounds = BoundsOf(completion.Child as FrameworkElement), completionSide = completion.IsOpen ? (InwardRight() ? "right" : "left") : "", activityCount = activities.Children.Count, toolbarVisible = toolbarShown, toolbarBounds = BoundsOf(toolbar), spriteBounds = BoundsOf(sprite), buttons = labels }); return;
      }
      if (type != "state") return;
      preferences = Obj(message, "preferences"); context = Obj(message, "context"); currentName = Str(message, "name"); ApplyLanguage(message);
      statusLabel = Str(message, "label", "随时准备好"); chatTitle.Text = currentName + " · " + T("聊一聊");
      AutomationProperties.SetHelpText(this, currentName + " · " + T(statusLabel));
      double scale = Math.Max(.35, Math.Min(1.5, Num(preferences, "scale", .72)));
      mini = Str(preferences, "mode") == "mini"; dragGrip.Visibility = mini ? Visibility.Visible : Visibility.Collapsed; dragGrip.ToolTip = T("拖动移动"); AutomationProperties.SetName(dragGrip, T("拖动移动")); sprite.Visibility = mini ? Visibility.Collapsed : Visibility.Visible;
      sprite.Width = 192 * scale; sprite.Height = 208 * scale; Width = Math.Max(language == "en" ? 220 : 184, sprite.Width + 10);
      ApplyTheme(Obj(message, "theme"));
      chat.PopupAnimation = activity.PopupAnimation = Bool(preferences, "reducedMotion") ? PopupAnimation.None : PopupAnimation.Fade;
      UpdateWorkspaces();
      var rowList = new List<object>(); var incomingRows = Get(message, "rows") as IEnumerable;
      if (incomingRows != null) foreach (var value in incomingRows) rowList.Add(value);
      var rows = rowList.ToArray(); string rowsKey = NativeApp.Json.Serialize(rows) + ":" + dark + ":" + language;
      var activityLabel = (TextBlock)((StackPanel)activityButton.Content).Children[1]; activityLabel.Text = T("动态") + (rows.Length == 0 ? "" : " " + rows.Length); AutomationProperties.SetName(activityButton, activityLabel.Text);
      if (rowsKey != lastRows) {
        lastRows = rowsKey; foreach (var element in activities.Children) { var previous = element as Button; if (previous != null) buttons.Remove(previous); } activities.Children.Clear();
        activitySummary.Text = rows.Length == 0 ? T("安心做你的事，新进展会出现在这里。") : T("{count} 项进展 · 点击回到对应会话").Replace("{count}", Convert.ToString(rows.Length));
        if (rows.Length == 0) {
          var empty = new StackPanel { Margin = new Thickness(0, 18, 0, 20) };
          empty.Children.Add(new TextBlock { Text = "✓", FontSize = 30, Foreground = accent, HorizontalAlignment = HorizontalAlignment.Center });
          empty.Children.Add(new TextBlock { Text = T("都安排好了"), FontSize = 14, Foreground = fg, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 8, 0, 6) });
          empty.Children.Add(new TextBlock { Text = T("暂时没有需要关注的任务"), FontSize = 11, Foreground = muted, TextAlignment = TextAlignment.Center }); activities.Children.Add(empty);
        } else foreach (var item in rows) {
          var task = item as Dictionary<string, object>; if (task == null) continue; string sessionId = Str(task, "id");
          var button = MakeButton(Str(task, "title") + "\n" + T(Str(task, "label")), delegate { activity.IsOpen = false; OpenHarness(); NativeApp.Emit(new { type = "open-session", sessionId = sessionId }); }); button.Focusable = false;
          string state = Str(task, "state"); Brush tint = Color(state == "needs-input" ? (dark ? "#F0C88D" : "#A36B17") : state == "blocked" ? (dark ? "#F19C9C" : "#BE5361") : state == "ready" ? (dark ? "#96D3B8" : "#338365") : (dark ? "#90B8EF" : "#4279C9"));
          var card = new Grid { Width = 272, Margin = new Thickness(1, 5, 1, 5) }; card.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(22) }); card.ColumnDefinitions.Add(new ColumnDefinition()); card.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(18) });
          var dot = new System.Windows.Shapes.Ellipse { Width = 7, Height = 7, Fill = tint, VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 6, 0, 0) }; card.Children.Add(dot);
          var detail = new StackPanel(); Grid.SetColumn(detail, 1); detail.Children.Add(new TextBlock { Text = Str(task, "title"), FontSize = 12, FontWeight = FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis }); detail.Children.Add(new TextBlock { Text = T(Str(task, "label")), Foreground = tint, FontSize = 10, Margin = new Thickness(0, 5, 0, 0) }); card.Children.Add(detail);
          var arrow = new TextBlock { Text = "›", Foreground = muted, FontSize = 19, VerticalAlignment = VerticalAlignment.Center }; Grid.SetColumn(arrow, 2); card.Children.Add(arrow);
          button.Content = card; button.ToolTip = Str(task, "title") + " · " + T(Str(task, "label")); button.Margin = new Thickness(0, 3, 0, 3); PaintButton(button, false); button.HorizontalContentAlignment = HorizontalAlignment.Left; activities.Children.Add(button);
        }
      }
      bool desktop = Str(preferences, "surface", "desktop") == "desktop"; SetHotkey(desktop);
      if (desktop && Bool(preferences, "visible", true)) { if (!IsVisible) Show(); } else { chat.IsOpen = false; activity.IsOpen = false; completion.IsOpen = false; Hide(); }
      var position = Get(preferences, "desktopPosition") as Dictionary<string, object>;
      string positionKey = NativeApp.Json.Serialize(position);
      if (firstPosition || (!pointerDown && positionKey != stateKey)) {
        stateKey = positionKey; firstPosition = false;
        Left = position == null ? SystemParameters.WorkArea.Right - Width - 32 : Num(position, "x", 200);
        Top = position == null ? SystemParameters.WorkArea.Bottom - sprite.Height - 78 : Num(position, "y", 200);
        ClampToScreen();
      }
      UpdateToolbar();
      ShowCompletions(message);
    }
    void Draw() { int index = row * 8 + column; if (index >= 0 && index < frames.Length) sprite.Source = frames[index]; }
  }
  static class BorderExtensions { public static void TextBlockForeground(this Border border, Brush brush) { TextElement.SetForeground(border, brush); } }
}
