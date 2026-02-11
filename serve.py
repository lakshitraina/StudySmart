import http.server
import socketserver
import webbrowser

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler
# Add MIME type for JS modules if needed (usually defaults are fine in Python 3)
Handler.extensions_map.update({
    ".js": "application/javascript",
})

print(f"Serving at port {PORT}")
print(f"Opening http://localhost:{PORT} in your browser...")

# Open browser automatically
webbrowser.open(f"http://localhost:{PORT}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
