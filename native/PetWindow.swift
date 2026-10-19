// macOS companion: AppKit windows, private JSON lines, no browser credentials.
import AppKit
import Carbon
import Darwin

func emit(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value), var line = String(data: data, encoding: .utf8) {
        line += "\n"
        FileHandle.standardOutput.write(Data(line.utf8))
    }
}
func string(_ dict: [String: Any], _ key: String, _ fallback: String = "") -> String { dict[key] as? String ?? fallback }
func number(_ dict: [String: Any], _ key: String, _ fallback: Double = 0) -> Double { (dict[key] as? NSNumber)?.doubleValue ?? fallback }
func rows(_ dict: [String: Any], _ key: String) -> [[String: Any]] { dict[key] as? [[String: Any]] ?? [] }

class FlippedView: NSView { override var isFlipped: Bool { true } }
class CompanionPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
class ActionButton: NSButton {
    var invoke: (() -> Void)?
    convenience init(_ title: String, _ callback: @escaping () -> Void) {
        self.init(frame: .zero); self.title = title; invoke = callback
        target = self; action = #selector(pressed); bezelStyle = .rounded; font = .systemFont(ofSize: 12)
    }
    @objc func pressed() { invoke?() }
}

class SpriteView: NSView {
    weak var companion: Companion?
    var sprite: NSImage?
    var downPoint = NSPoint.zero, downOrigin = NSPoint.zero
    var dragged = false
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { false }
    override func draw(_ dirtyRect: NSRect) {
        guard let owner = companion else { return }
        if owner.mini {
            NSColor.controlBackgroundColor.withAlphaComponent(0.94).setFill()
            NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 2), xRadius: 16, yRadius: 16).fill()
            let text = "⠿  " + owner.name + " · " + owner.label
            (text as NSString).draw(in: bounds.insetBy(dx: 12, dy: 10), withAttributes: [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor.labelColor])
        } else {
            sprite?.draw(in: bounds, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
        }
    }
    override func updateTrackingAreas() {
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.inVisibleRect, .activeAlways, .mouseEnteredAndExited], owner: self))
        super.updateTrackingAreas()
    }
    override func mouseEntered(with event: NSEvent) { companion?.setHover(true) }
    override func mouseExited(with event: NSEvent) { companion?.setHover(false) }
    override func mouseDown(with event: NSEvent) {
        downPoint = NSEvent.mouseLocation; downOrigin = window?.frame.origin ?? .zero; dragged = false
    }
    override func mouseDragged(with event: NSEvent) {
        guard let owner = companion else { return }
        let point = NSEvent.mouseLocation
        if !dragged && hypot(point.x-downPoint.x, point.y-downPoint.y) < 3 { return }
        dragged = true; owner.dragging = true
        emit(["type": "drag", "active": true, "direction": point.x < downPoint.x ? "left" : "right"])
        owner.pet.setFrameOrigin(owner.clamped(NSPoint(x: downOrigin.x+point.x-downPoint.x, y: downOrigin.y+point.y-downPoint.y), size: owner.pet.frame.size))
    }
    override func mouseUp(with event: NSEvent) {
        companion?.dragging = false
        emit(["type": "drag", "active": false])
        if dragged, let origin = window?.frame.origin { emit(["type": "position", "x": origin.x, "y": origin.y]) }
        else { emit(["type": "greet"]) }
    }
}

class Companion: NSObject, NSWindowDelegate {
    let pet = CompanionPanel(contentRect: NSRect(x: 0, y: 0, width: 190, height: 190), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    let spriteView = SpriteView(), controls = FlippedView()
    var frames: [NSImage] = [], frameRow = 0, frameColumn = 0
    var prefs: [String: Any] = [:], context: [String: Any] = [:], messages: [String: String] = [:]
    var name = "deepseek", label = "", mini = false, dragging = false, hover = false
    var chat: CompanionPanel!, activity: CompanionPanel!, bubble: CompanionPanel!
    let workspace = NSPopUpButton(frame: .zero, pullsDown: false), session = NSPopUpButton(frame: .zero, pullsDown: false)
    let prompt = NSTextView(), feedback = NSTextField(labelWithString: "")
    let activities = NSStackView(), activityScroll = NSScrollView()
    var chatButton: ActionButton!, activityButton: ActionButton!, settingsButton: ActionButton!
    var sendButton: ActionButton!, editButton: ActionButton!
    var heading = NSTextField(labelWithString: ""), bubbleButton: ActionButton!
    var storedPosition: String?, contextKey = "", activityKey = "", seen = Set<String>()
    var completionID = "", bubbleUntil: Double = 0, sending = false
    var hotKey: EventHotKeyRef?, hotKeyHandler: EventHandlerRef?, timer: Timer?
    var ownerPID = pid_t(Int32(ProcessInfo.processInfo.environment["DSH_PET_OWNER_PID"] ?? "0") ?? 0)

    override init() {
        super.init()
        configure(pet); pet.isOpaque = false; pet.backgroundColor = .clear; pet.hasShadow = false
        pet.delegate = self; pet.contentView = FlippedView(); spriteView.companion = self
        pet.contentView?.addSubview(spriteView); pet.contentView?.addSubview(controls)
        chatButton = ActionButton("聊一聊") { [weak self] in self?.toggleChat() }
        activityButton = ActionButton("动态") { [weak self] in self?.toggleActivity() }
        settingsButton = ActionButton("⚙") { [weak self] in self?.openHost(["type": "open-settings"]) }
        for button in [chatButton!, activityButton!, settingsButton!] { controls.addSubview(button) }
        controls.alphaValue = 0
        chat = makePanel(width: 360, height: 320); activity = makePanel(width: 360, height: 280)
        bubble = makePanel(width: 280, height: 100)
        buildChat(); buildActivity()
        bubbleButton = ActionButton("") { [weak self] in
            guard let self = self else { return }; self.bubble.orderOut(nil)
            self.openHost(["type": "open-session", "sessionId": self.completionID])
        }
        bubbleButton.frame = NSRect(x: 12, y: 14, width: 256, height: 68)
        bubbleButton.cell?.wraps = true; bubble.contentView?.addSubview(bubbleButton)
        pet.setFrameOrigin(defaultOrigin()); layout()
        registerHotkey()
        timer = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { [weak self] _ in self?.tick() }
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        emit(["type": "ready"])
    }
    func configure(_ panel: CompanionPanel) {
        panel.level = .floating; panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.animationBehavior = .none; panel.becomesKeyOnlyIfNeeded = true
    }
    func makePanel(width: CGFloat, height: CGFloat) -> CompanionPanel {
        let panel = CompanionPanel(contentRect: NSRect(x: 0, y: 0, width: width, height: height), styleMask: [.titled, .utilityWindow, .nonactivatingPanel], backing: .buffered, defer: false)
        configure(panel); panel.titleVisibility = .hidden; panel.titlebarAppearsTransparent = true
        panel.contentView = FlippedView(); panel.standardWindowButton(.closeButton)?.isHidden = true
        return panel
    }
    func t(_ text: String) -> String { string(prefs, "language") == "en" ? messages[text] ?? text : text }
    func buildChat() {
        let view = chat.contentView!
        heading.frame = NSRect(x: 16, y: 8, width: 280, height: 22); view.addSubview(heading)
        let close = ActionButton("×") { [weak self] in self?.chat.orderOut(nil) }
        close.frame = NSRect(x: 314, y: 4, width: 30, height: 26); view.addSubview(close)
        workspace.frame = NSRect(x: 14, y: 40, width: 332, height: 28)
        workspace.target = self; workspace.action = #selector(workspaceChanged); view.addSubview(workspace)
        session.frame = NSRect(x: 14, y: 76, width: 332, height: 28); view.addSubview(session)
        let scroll = NSScrollView(frame: NSRect(x: 16, y: 116, width: 328, height: 102))
        scroll.hasVerticalScroller = true; scroll.borderType = .bezelBorder
        prompt.frame = NSRect(x: 0, y: 0, width: 308, height: 102); prompt.isRichText = false
        prompt.isAutomaticQuoteSubstitutionEnabled = false; prompt.isAutomaticDashSubstitutionEnabled = false
        prompt.isVerticallyResizable = true; prompt.isHorizontallyResizable = false
        prompt.textContainer?.widthTracksTextView = true; prompt.autoresizingMask = [.width]
        prompt.font = .systemFont(ofSize: 14); scroll.documentView = prompt; view.addSubview(scroll)
        feedback.frame = NSRect(x: 16, y: 224, width: 328, height: 30); feedback.font = .systemFont(ofSize: 11)
        feedback.maximumNumberOfLines = 2; view.addSubview(feedback)
        editButton = ActionButton("") { [weak self] in self?.submit(edit: true) }
        sendButton = ActionButton("") { [weak self] in self?.submit(edit: false) }
        editButton.frame = NSRect(x: 14, y: 268, width: 224, height: 30)
        sendButton.frame = NSRect(x: 246, y: 268, width: 100, height: 30)
        view.addSubview(editButton); view.addSubview(sendButton)
    }
    func buildActivity() {
        let close = ActionButton("×") { [weak self] in self?.activity.orderOut(nil) }
        close.frame = NSRect(x: 316, y: 4, width: 28, height: 26); activity.contentView?.addSubview(close)
        activityScroll.frame = NSRect(x: 12, y: 36, width: 336, height: 228)
        activityScroll.hasVerticalScroller = true; activityScroll.drawsBackground = false
        activities.orientation = .vertical; activities.alignment = .leading; activities.spacing = 6
        activities.frame = NSRect(x: 0, y: 0, width: 316, height: 228)
        activityScroll.documentView = activities; activity.contentView?.addSubview(activityScroll)
    }
    func openHost(_ message: [String: Any]) {
        emit(message)
        if ownerPID > 1 { NSRunningApplication(processIdentifier: ownerPID)?.activate(options: [.activateIgnoringOtherApps]) }
    }
    func submit(edit: Bool) {
        guard !sending, let wid = workspace.selectedItem?.representedObject as? String, !wid.isEmpty else {
            feedback.stringValue = t("请选择工作区"); return
        }
        if !edit && prompt.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return }
        var event: [String: Any] = ["type": edit ? "edit-chat" : "send-chat", "text": prompt.string, "workspaceId": wid]
        if let sid = session.selectedItem?.representedObject as? String, !sid.isEmpty { event["sessionId"] = sid }
        sending = true; sendButton.isEnabled = false; editButton.isEnabled = false; feedback.stringValue = t("正在发送…")
        if edit { openHost(event) } else { emit(event) }
    }
    func toggleChat() {
        guard pet.isVisible else { return }
        if chat.isVisible { chat.orderOut(nil) } else {
            activity.orderOut(nil); positionPanels(); chat.makeKeyAndOrderFront(nil); chat.makeFirstResponder(prompt)
        }
        updateHover()
    }
    func toggleActivity() {
        guard pet.isVisible else { return }
        if activity.isVisible { activity.orderOut(nil) } else { chat.orderOut(nil); positionPanels(); activity.orderFrontRegardless() }
        updateHover()
    }
    @objc func workspaceChanged() { populateSessions() }
    func populateContext() {
        let previous = workspace.selectedItem?.representedObject as? String
        workspace.removeAllItems(); workspace.addItem(withTitle: t("请选择工作区")); workspace.lastItem?.representedObject = ""
        for row in rows(context, "workspaces") {
            workspace.addItem(withTitle: string(row, "title", string(row, "path")))
            workspace.lastItem?.representedObject = string(row, "workspaceId")
        }
        let wanted = previous ?? string(context, "currentWorkspaceId")
        if let item = workspace.itemArray.first(where: { ($0.representedObject as? String) == wanted }) { workspace.select(item) }
        populateSessions()
    }
    func populateSessions() {
        let previous = session.selectedItem?.representedObject as? String
        let wid = workspace.selectedItem?.representedObject as? String ?? ""
        session.removeAllItems(); session.addItem(withTitle: t("+ 新会话")); session.lastItem?.representedObject = ""
        for row in rows(context, "sessions") where string(row, "workspaceId") == wid {
            session.addItem(withTitle: string(row, "title", t("未命名会话")))
            session.lastItem?.representedObject = string(row, "sessionId")
        }
        if let wanted = previous, let item = session.itemArray.first(where: { ($0.representedObject as? String) == wanted }) { session.select(item) }
    }
    func populateActivity(_ incoming: [[String: Any]]) {
        for view in activities.arrangedSubviews { activities.removeArrangedSubview(view); view.removeFromSuperview() }
        if incoming.isEmpty { activities.addArrangedSubview(NSTextField(labelWithString: t("暂无任务动态"))) }
        for row in incoming {
            let button = ActionButton(string(row, "title") + " · " + t(string(row, "label"))) { [weak self] in
                self?.openHost(["type": "open-session", "sessionId": string(row, "id")])
            }
            button.widthAnchor.constraint(equalToConstant: 310).isActive = true
            button.heightAnchor.constraint(equalToConstant: 34).isActive = true
            button.cell?.truncatesLastVisibleLine = true; activities.addArrangedSubview(button)
        }
        activities.setFrameSize(NSSize(width: 316, height: max(228, CGFloat(incoming.count)*40)))
    }
    func layout() {
        mini = string(prefs, "mode") == "mini"
        let scale = min(1.5, max(0.35, number(prefs, "scale", 0.72)))
        let spriteSize = mini ? NSSize(width: 280, height: 44) : NSSize(width: 192*scale, height: 208*scale)
        let size = NSSize(width: max(190, spriteSize.width+16), height: spriteSize.height+42)
        pet.setContentSize(size); spriteView.frame = NSRect(x: (size.width-spriteSize.width)/2, y: 0, width: spriteSize.width, height: spriteSize.height)
        controls.frame = NSRect(x: (size.width-188)/2, y: spriteSize.height+2, width: 188, height: 36)
        chatButton.frame = NSRect(x: 0, y: 0, width: 78, height: 30)
        activityButton.frame = NSRect(x: 80, y: 0, width: 72, height: 30)
        settingsButton.frame = NSRect(x: 154, y: 0, width: 32, height: 30)
        pet.setFrameOrigin(clamped(pet.frame.origin, size: pet.frame.size)); positionPanels(); spriteView.needsDisplay = true
    }
    func defaultOrigin() -> NSPoint {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        return NSPoint(x: screen.maxX-240, y: screen.minY+80)
    }
    func screenFor(_ point: NSPoint) -> NSRect {
        if let screen = NSScreen.screens.first(where: { $0.visibleFrame.contains(point) }) { return screen.visibleFrame }
        return NSScreen.screens.min(by: { hypot($0.visibleFrame.midX-point.x, $0.visibleFrame.midY-point.y) < hypot($1.visibleFrame.midX-point.x, $1.visibleFrame.midY-point.y) })?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
    }
    func clamped(_ point: NSPoint, size: NSSize) -> NSPoint {
        let screen = screenFor(NSPoint(x: point.x+size.width/2, y: point.y+size.height/2))
        return NSPoint(x: min(max(point.x, screen.minX), max(screen.minX, screen.maxX-size.width)), y: min(max(point.y, screen.minY), max(screen.minY, screen.maxY-size.height)))
    }
    func positionPanels() {
        let rect = pet.frame, screen = screenFor(NSPoint(x: rect.midX, y: rect.midY))
        let right = rect.midX < screen.midX
        for panel in [chat!, activity!, bubble!] {
            let x = right ? rect.maxX+8 : rect.minX-panel.frame.width-8
            let y = panel === bubble ? rect.maxY-12 : rect.maxY-panel.frame.height
            panel.setFrameOrigin(clamped(NSPoint(x: x, y: y), size: panel.frame.size))
        }
    }
    func windowDidMove(_ notification: Notification) { positionPanels() }
    @objc func screensChanged() { pet.setFrameOrigin(clamped(pet.frame.origin, size: pet.frame.size)) }
    func setHover(_ value: Bool) { hover = value; emit(["type": "hover", "value": value]); updateHover() }
    func updateHover() {
        let point = NSEvent.mouseLocation
        let near = pet.frame.insetBy(dx: -24, dy: -24).contains(point) || chat.isVisible || activity.isVisible
        let reduced = prefs["reducedMotion"] as? Bool == true || NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        NSAnimationContext.runAnimationGroup { animation in
            animation.duration = reduced ? 0 : 0.18
            controls.animator().alphaValue = near ? 1 : 0
            pet.animator().alphaValue = string(prefs, "visibilityBehavior") == "on-demand" && !near ? 0.12 : 1
        }
        for button in [chatButton!, activityButton!, settingsButton!] { button.isEnabled = near }
    }
    func tick() {
        if ownerPID > 1 && kill(ownerPID, 0) != 0 && errno == ESRCH { NSApp.terminate(nil); return }
        updateHover()
        if bubble.isVisible && Date().timeIntervalSince1970*1000 > bubbleUntil { bubble.orderOut(nil) }
        guard pet.isVisible, !dragging, prefs["followPointer"] as? Bool != false else { return }
        let point = NSEvent.mouseLocation, center = NSPoint(x: pet.frame.midX, y: pet.frame.midY)
        // Sprite directions start at up and proceed clockwise.
        var angle = atan2(point.x-center.x, point.y-center.y); if angle < 0 { angle += 2 * .pi }
        emit(["type": "gaze", "direction": Int((angle / (2 * .pi) * 16).rounded()) % 16])
    }
    func registerHotkey() {
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, _ in
            DispatchQueue.main.async { companion?.toggleChat() }; return noErr
        }, 1, &spec, nil, &hotKeyHandler)
        let result = RegisterEventHotKey(UInt32(kVK_ANSI_P), UInt32(cmdKey | optionKey | shiftKey), EventHotKeyID(signature: 0x44534850, id: 1), GetApplicationEventTarget(), 0, &hotKey)
        emit(["type": "hotkey", "registered": result == noErr])
    }
    func accept(_ message: [String: Any]) {
        switch string(message, "type") {
        case "atlas":
            guard let data = Data(base64Encoded: string(message, "base64")), let image = NSImage(data: data), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
            let scale = cg.width / 1536
            guard [1, 2].contains(scale), cg.width == 1536*scale, [9*208*scale, 11*208*scale].contains(cg.height) else { return }
            var next: [NSImage] = []
            for row in 0..<(cg.height/(208*scale)) { for column in 0..<8 {
                guard let crop = cg.cropping(to: CGRect(x: CGFloat(column*192*scale), y: CGFloat(row*208*scale), width: CGFloat(192*scale), height: CGFloat(208*scale))) else { return }
                next.append(NSImage(cgImage: crop, size: NSSize(width: 192, height: 208)))
            } }
            frames = next; drawFrame()
        case "frame":
            frameRow = Int(number(message, "row")); frameColumn = Int(number(message, "column")); drawFrame()
        case "state":
            prefs = message["preferences"] as? [String: Any] ?? [:]; context = message["context"] as? [String: Any] ?? [:]
            messages = message["messages"] as? [String: String] ?? [:]; name = string(message, "name", "deepseek"); label = t(string(message, "label"))
            pet.appearance = NSAppearance(named: (message["theme"] as? [String: Any])?["dark"] as? Bool == true ? .darkAqua : .aqua)
            for panel in [chat!, activity!, bubble!] { panel.appearance = pet.appearance }
            chatButton.title = t("聊一聊"); activityButton.title = t("动态"); heading.stringValue = t("聊一聊")
            sendButton.title = t("发送"); editButton.title = t("在主会话编辑")
            let language = string(prefs, "language")
            let nextContext = String(describing: context)+language
            if nextContext != contextKey { contextKey = nextContext; populateContext() }
            let incoming = rows(message, "rows"), nextActivity = String(describing: incoming)+language
            if nextActivity != activityKey { activityKey = nextActivity; populateActivity(incoming) }
            layout()
            if !dragging {
                let position = prefs["desktopPosition"] as? [String: Any]
                let key = position.map { "\(number($0, "x")),\(number($0, "y"))" } ?? "default"
                if key != storedPosition {
                    storedPosition = key
                    let point = position.map { NSPoint(x: number($0, "x"), y: number($0, "y")) } ?? defaultOrigin()
                    pet.setFrameOrigin(clamped(point, size: pet.frame.size))
                }
            }
            let visible = prefs["visible"] as? Bool != false && string(prefs, "surface") != "app"
            if visible { pet.orderFrontRegardless() } else { for panel in [pet, chat!, activity!, bubble!] { panel.orderOut(nil) } }
            for notice in rows(message, "completions") {
                let id = string(notice, "id")
                if id.isEmpty || seen.contains(id) { continue }; seen.insert(id)
                let expires = number(notice, "expiresAt")
                if !visible || expires < Date().timeIntervalSince1970*1000 { continue }
                completionID = string(notice, "sessionId"); bubbleUntil = expires
                bubbleButton.title = t("任务已完成") + "\n" + string(notice, "title")
                positionPanels(); bubble.orderFrontRegardless()
            }
            if seen.count > 1000 { seen = Set(rows(message, "completions").map { string($0, "id") }) }
        case "toggle-chat": toggleChat()
        case "reply":
            sending = false; sendButton.isEnabled = true; editButton.isEnabled = true
            if message["ok"] as? Bool == true {
                feedback.stringValue = t(string(message, "kind") == "edit-chat" ? "已转入主会话草稿，由你发送" : "已发送到 Harness")
                if string(message, "kind") == "send-chat" { prompt.string = "" }
                if string(message, "kind") == "edit-chat" { chat.orderOut(nil) }
            } else { feedback.stringValue = string(message, "error", t("发送失败，请在主会话中重试。")) }
        case "inspect" where ProcessInfo.processInfo.environment["DSH_PET_NATIVE_TEST"] == "1":
            if message["capture"] as? Bool == true, let output = ProcessInfo.processInfo.environment["DSH_PET_NATIVE_TEST_OUTPUT"] {
                for (name, panel) in [("pet", pet), ("chat", chat!)] {
                    if let view = panel.contentView, let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
                        view.cacheDisplay(in: view.bounds, to: bitmap)
                        if let data = bitmap.representation(using: .png, properties: [:]) {
                            try? data.write(to: URL(fileURLWithPath: output).appendingPathComponent("macos-\(name).png"))
                        }
                    }
                }
            }
            let rect = pet.frame
            emit(["type": "inspection", "visible": pet.isVisible, "floating": pet.level == .floating, "frameCount": frames.count,
                  "frameRow": frameRow, "frameColumn": frameColumn, "mini": mini, "chatOpen": chat.isVisible,
                  "x": rect.minX, "y": rect.minY, "chatX": chat.frame.minX, "chatY": chat.frame.minY,
                  "workspaceCount": max(0, workspace.numberOfItems-1), "sessionCount": max(0, session.numberOfItems-1)])
        default: break
        }
    }
    func drawFrame() {
        guard (0..<8).contains(frameColumn), frameRow >= 0, frameRow < frames.count/8 else { return }
        spriteView.sprite = frames[frameRow*8+frameColumn]; spriteView.needsDisplay = true
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
var companion: Companion?
DispatchQueue.main.async { companion = Companion() }
DispatchQueue.global(qos: .userInitiated).async {
    // Each line is processed before reading the next: bound queued atlas memory.
    while let line = readLine() {
        guard line.utf8.count < 40*1024*1024, let data = line.data(using: .utf8), let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { continue }
        DispatchQueue.main.sync { companion?.accept(value) }
    }
    DispatchQueue.main.async { NSApp.terminate(nil) }
}
app.run()
