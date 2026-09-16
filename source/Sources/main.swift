import AppKit
import WebKit

// Build 164: Mac-only shell. All instruments load from the bundle.
// No Network framework, sockets, Bonjour, pairing UI or phone message handlers.
final class BundleLoader: NSObject, WKURLSchemeHandler {
    let root: URL
    init(_ root: URL) { self.root = root.standardizedFileURL.resolvingSymlinksInPath() }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.scheme == "toolbox", url.host == "toolbox" else {
            task.didFailWithError(URLError(.unsupportedURL)); return
        }
        let parts = url.path.split(separator: "/").map(String.init)
        guard !parts.contains(".."), !parts.contains(where: { $0.contains("\\") || $0.contains("\0") }) else {
            task.didFailWithError(URLError(.noPermissionsToReadFile)); return
        }
        var file = root
        for part in parts { file.appendPathComponent(part) }
        var directory: ObjCBool = false
        if FileManager.default.fileExists(atPath: file.path, isDirectory: &directory), directory.boolValue {
            file.appendPathComponent("index.html")
        }
        file = file.standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"), let bytes = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let types = ["html":"text/html; charset=utf-8", "js":"text/javascript; charset=utf-8", "css":"text/css", "json":"application/json", "svg":"image/svg+xml", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "wav":"audio/wav", "mp3":"audio/mpeg", "woff":"font/woff", "woff2":"font/woff2", "mid":"audio/midi", "txt":"text/plain"]
        let headers = ["Content-Type":types[file.pathExtension.lowercased()] ?? "application/octet-stream", "Content-Length":String(bytes.count), "Access-Control-Allow-Origin":"*", "X-Content-Type-Options":"nosniff"]
        guard let response = HTTPURLResponse(url:url, statusCode:200, httpVersion:"HTTP/1.1", headerFields:headers) else {
            task.didFailWithError(URLError(.badServerResponse)); return
        }
        task.didReceive(response); task.didReceive(bytes); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var returningHome = false
    let start = URL(string:"toolbox://toolbox/index.html")!
    let routes = ["index.html", "threes/index.html", "infinity/index.html", "time/index.html"]
    var qaFinished = false
    var qaIndex = 0
    var qaResults: [[String:Any]] = []
    var qa: Bool { CommandLine.arguments.contains("--verify-release") }
    var root: URL { Bundle.main.resourceURL!.appendingPathComponent("dist", isDirectory:true) }

    func configuration() -> WKWebViewConfiguration {
        let c = WKWebViewConfiguration()
        c.setURLSchemeHandler(BundleLoader(root), forURLScheme:"toolbox")
        c.websiteDataStore = qa ? .nonPersistent() : .default()
        c.mediaTypesRequiringUserActionForPlayback = []
        if let path = Bundle.main.url(forResource:"native-audio", withExtension:"js"), let js = try? String(contentsOf:path, encoding:.utf8) {
            c.userContentController.addUserScript(WKUserScript(source:js, injectionTime:.atDocumentStart, forMainFrameOnly:false))
        }
        if qa {
            c.userContentController.addUserScript(WKUserScript(source:"window.__releaseErrors=[];addEventListener('error',e=>window.__releaseErrors.push(String(e.message||e.target?.src||'resource failure')),true);addEventListener('unhandledrejection',e=>window.__releaseErrors.push(String(e.reason)));", injectionTime:.atDocumentStart, forMainFrameOnly:true))
        }
        return c
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        guard FileManager.default.fileExists(atPath:root.appendingPathComponent("index.html").path) else {
            if qa { finishQA(error:"The bundled Toolbox files are missing."); return }
            message("The bundled Toolbox files are missing. Rebuild from the complete Build 164 folder."); NSApp.terminate(nil); return
        }
        installMenus()
        let frame = NSScreen.main?.visibleFrame ?? NSRect(x:0,y:0,width:1360,height:900)
        window = NSWindow(contentRect:frame, styleMask:[.titled,.closable,.miniaturizable,.resizable], backing:.buffered, defer:false)
        window.title = "Composer's Toolbox"
        window.minSize = NSSize(width:1000,height:680)
        window.collectionBehavior = [.fullScreenPrimary]
        window.tabbingMode = .disallowed
        window.isReleasedWhenClosed = false
        window.delegate = self
        let config = configuration()
        web = WKWebView(frame:.zero, configuration:config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.setAccessibilityLabel("Composer's Toolbox instruments")
        let home = NSButton(title:"Return to Toolbox", target:self, action:#selector(goHome))
        home.bezelStyle = .rounded
        home.toolTip = "Stop playback and return to the Toolbox entrance"
        let bar = NSStackView(views:[home]); bar.orientation = .horizontal
        bar.edgeInsets = NSEdgeInsets(top:5,left:10,bottom:5,right:10)
        let container = NSView(); window.contentView = container
        for view in [bar as NSView, web! as NSView] { view.translatesAutoresizingMaskIntoConstraints = false; container.addSubview(view) }
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo:container.topAnchor), bar.leadingAnchor.constraint(equalTo:container.leadingAnchor),
            bar.trailingAnchor.constraint(lessThanOrEqualTo:container.trailingAnchor),
            web.topAnchor.constraint(equalTo:bar.bottomAnchor), web.leadingAnchor.constraint(equalTo:container.leadingAnchor),
            web.trailingAnchor.constraint(equalTo:container.trailingAnchor), web.bottomAnchor.constraint(equalTo:container.bottomAnchor)
        ])
        if !qa { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps:true) }
        web.load(URLRequest(url:start))
        if !qa { DispatchQueue.main.async { self.window.toggleFullScreen(nil) } }
        if qa {
            DispatchQueue.main.asyncAfter(deadline:.now()+90) { self.finishQA(error:"Native verification timed out") }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication) -> Bool { !qa }
    func applicationShouldTerminate(_ sender:NSApplication) -> NSApplication.TerminateReply {
        if qa && !qaFinished { finishQA(error:"Native verification was interrupted") }
        return .terminateNow
    }
    func applicationWillTerminate(_ notification:Notification) { web?.evaluateJavaScript("window.ctNativeStopAudio?.()",completionHandler:nil) }
    @objc func goHome() {
        guard !returningHome else { return }; returningHome = true
        web.callAsyncJavaScript("await window.ctNativeStopAudio?.(); return true;", arguments:[:], in:nil, in:.page) { _ in
            self.web.load(URLRequest(url:self.start)); self.returningHome = false
        }
    }
    @objc func reload() { web.reload() }
    @objc func fullScreen() { window.toggleFullScreen(nil) }
    func installMenus() {
        let menu = NSMenu()
        let appItem = NSMenuItem(); let appMenu = NSMenu(); appItem.submenu = appMenu; menu.addItem(appItem)
        appMenu.addItem(withTitle:"About Composer's Toolbox", action:#selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent:"")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle:"Quit Composer's Toolbox",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        let editItem = NSMenuItem(); editItem.title = "Edit"; let edit = NSMenu(title:"Edit"); editItem.submenu = edit; menu.addItem(editItem)
        for (title,action,key) in [("Undo","undo:","z"),("Redo","redo:","Z"),("Cut","cut:","x"),("Copy","copy:","c"),("Paste","paste:","v"),("Select All","selectAll:","a")] {
            edit.addItem(withTitle:title,action:Selector(action),keyEquivalent:key)
        }
        let viewItem = NSMenuItem(); viewItem.title = "View"; let view = NSMenu(title:"View"); viewItem.submenu = view; menu.addItem(viewItem)
        for (title,action,key) in [("Return to Toolbox",#selector(goHome),"0"),("Reload",#selector(reload),"r"),("Toggle Full Screen",#selector(fullScreen),"f")] {
            let item = view.addItem(withTitle:title,action:action,keyEquivalent:key); item.target = self
            if key == "f" { item.keyEquivalentModifierMask = [.control,.command] }
        }
        NSApp.mainMenu = menu
    }
    func message(_ text:String) {
        let a = NSAlert(); a.messageText = "Composer's Toolbox"; a.informativeText = text; a.addButton(withTitle:"OK"); a.runModal()
    }
    func webView(_ webView:WKWebView, didFinish navigation:WKNavigation!) {
        guard qa else { return }
        DispatchQueue.main.asyncAfter(deadline:.now()+1.5) {
            let script = """
            (()=>{const k='__build164check',old=localStorage.getItem(k);localStorage.setItem(k,'ok');const storage=localStorage.getItem(k)==='ok';if(old===null)localStorage.removeItem(k);else localStorage.setItem(k,old);return {route:location.pathname,buttons:document.querySelectorAll('button').length,storage,errors:window.__releaseErrors||[],phoneBridge:typeof window.ctCompanionReceive!=='undefined',ready:document.readyState};})()
            """
            webView.evaluateJavaScript(script) { value,error in
                guard var result = value as? [String:Any], error == nil else { self.finishQA(error:error?.localizedDescription ?? "Invalid native verification result"); return }
                result["pass"] = (result["storage"] as? Bool == true) && (result["buttons"] as? Int ?? 0)>0 && (result["errors"] as? [String] ?? ["missing"]).isEmpty && (result["phoneBridge"] as? Bool == false)
                self.qaResults.append(result); self.qaIndex += 1
                if self.qaIndex == self.routes.count { self.finishQA(error:nil) }
                else { webView.load(URLRequest(url:URL(string:"toolbox://toolbox/"+self.routes[self.qaIndex])!)) }
            }
        }
    }
    func finishQA(error:String?) {
        guard !qaFinished else { return }; qaFinished = true
        let pass = error == nil && qaResults.count == 4 && qaResults.allSatisfy { $0["pass"] as? Bool == true }
        let result:[String:Any] = ["build":"164","pass":pass,"checks":qaResults,"error":error ?? "","physicalAudioTested":false,"finalDistributionSignatureTested":false]
        do {
            guard let i = CommandLine.arguments.firstIndex(of:"--report"), CommandLine.arguments.count > i+1 else {
                throw NSError(domain:"ToolboxVerification", code:1, userInfo:[NSLocalizedDescriptionKey:"Missing --report destination"])
            }
            let bytes = try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys])
            try bytes.write(to:URL(fileURLWithPath:CommandLine.arguments[i+1]), options:.atomic)
        } catch {
            fputs("Cannot write native verification report: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
        print(pass ? "BUILD_164_NATIVE_CHECK_PASS" : "BUILD_164_NATIVE_CHECK_FAILED")
        exit(pass ? 0 : 1)
    }
    func webView(_ webView:WKWebView, decidePolicyFor action:WKNavigationAction, decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if (url.scheme == "toolbox" && url.host == "toolbox") || url.absoluteString == "about:blank" {
            decisionHandler(action.shouldPerformDownload ? .cancel : .allow); return
        }
        decisionHandler(.cancel)
        if action.navigationType == .linkActivated, ["http","https","mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
    }
    func webView(_ webView:WKWebView, decidePolicyFor response:WKNavigationResponse, decisionHandler:@escaping(WKNavigationResponsePolicy)->Void) { decisionHandler(response.canShowMIMEType ? .allow : .cancel) }
    func webView(_ webView:WKWebView, createWebViewWith configuration:WKWebViewConfiguration, for action:WKNavigationAction, windowFeatures:WKWindowFeatures)->WKWebView? {
        if let url=action.request.url {
            if url.scheme == "toolbox" && url.host == "toolbox" { webView.load(action.request) }
            else if ["http","https","mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        }
        return nil
    }
    func webView(_ webView:WKWebView, runOpenPanelWith parameters:WKOpenPanelParameters, initiatedByFrame frame:WKFrameInfo, completionHandler:@escaping([URL]?)->Void) {
        completionHandler(nil)
    }
    func webView(_ webView:WKWebView, runJavaScriptAlertPanelWithMessage text:String, initiatedByFrame frame:WKFrameInfo, completionHandler:@escaping()->Void) { message(text); completionHandler() }
    func webView(_ webView:WKWebView, runJavaScriptConfirmPanelWithMessage text:String, initiatedByFrame frame:WKFrameInfo, completionHandler:@escaping(Bool)->Void) {
        let a=NSAlert(); a.messageText="Composer's Toolbox"; a.informativeText=text; a.addButton(withTitle:"OK"); a.addButton(withTitle:"Cancel")
        a.beginSheetModal(for:window) { completionHandler($0 == .alertFirstButtonReturn) }
    }
    func webView(_ webView:WKWebView, runJavaScriptTextInputPanelWithPrompt prompt:String, defaultText:String?, initiatedByFrame frame:WKFrameInfo, completionHandler:@escaping(String?)->Void) {
        let a=NSAlert(); a.messageText=prompt; a.addButton(withTitle:"OK"); a.addButton(withTitle:"Cancel")
        let f=NSTextField(string:defaultText ?? ""); f.frame=NSRect(x:0,y:0,width:320,height:24); a.accessoryView=f
        a.beginSheetModal(for:window) { completionHandler($0 == .alertFirstButtonReturn ? f.stringValue : nil) }
    }
    func webView(_ webView:WKWebView, didFailProvisionalNavigation navigation:WKNavigation!, withError error:Error) {
        if qa { finishQA(error:error.localizedDescription) }
        else if (error as NSError).code != NSURLErrorCancelled { message("The instrument could not load: "+error.localizedDescription) }
    }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {
        if qa { finishQA(error:"Web content process terminated") }
        else { message("The instrument process stopped. Use View → Reload to reopen it.") }
    }
}
let app=NSApplication.shared
let delegate=AppDelegate()
app.delegate=delegate
app.setActivationPolicy(delegate.qa ? .prohibited : .regular)
app.run()
