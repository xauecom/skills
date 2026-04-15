# MCP Server Setup Guide

This guide covers setting up the xaue-mcp-server (Model Context Protocol) across different platforms and environments.

**MCP Server Repository:** https://github.com/xauecom/xaue-mcp-server

## Prerequisites

- **Python 3.10+** installed on your system
- **uvx** package manager (installed as part of Python tools ecosystem)
- **Internet access** to download the MCP server

Check your Python version:
```bash
python3 --version
```

If you don't have uvx, install it:
```bash
pip install uv
```

## Claude Code (Desktop Client)

### Installation Steps

1. **Create or update `.mcp.json`** in your project root:

```json
{
  "mcpServers": {
    "xaue-mcp-server": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/xauecom/xaue-mcp-server", "xaue-mcp-server"]
    }
  }
}
```

2. **Restart Claude Code** to load the configuration:
   - Close Claude Code completely
   - Reopen it
   - The MCP server should initialize on startup

3. **Verify the connection** by asking Claude:
   > "What's the XAUE/XAUT exchange rate?"
   
   If working correctly, Claude should query the server and provide real-time data.

### Troubleshooting Claude Code

**Issue: "Server not available" error**
- Verify `.mcp.json` is in the project root (same directory as your skill)
- Check that `uvx` is installed: `uvx --version`
- Try manually running: `uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server`
- Check Claude Code logs for startup errors

**Issue: "Tool not found" error**
- The MCP server may not have finished initializing
- Restart Claude Code and wait 5-10 seconds before making requests
- Check internet connectivity for downloading the server

**Issue: Slow responses**
- First query after startup is slower (server initialization)
- Subsequent queries should be faster (cached)
- If consistently slow, verify network bandwidth

---

## Cline / VS Code MCP Extension

### Installation Steps

1. **Install the Cline extension** in VS Code:
   - Open VS Code Extensions (Cmd+Shift+X on Mac, Ctrl+Shift+X on Linux/Windows)
   - Search for "Cline"
   - Install the official Cline extension

2. **Add MCP server configuration** to VS Code settings:

   **Option A: Workspace Settings (Recommended)**
   
   Create `.vscode/settings.json` in your project root:
   ```json
   {
     "cline.mcpServers": [
       {
         "name": "xaue-mcp-server",
         "command": "uvx",
         "args": ["--from", "git+https://github.com/xauecom/xaue-mcp-server", "xaue-mcp-server"]
       }
     ]
   }
   ```

   **Option B: User Settings**
   
   In VS Code, open Settings (Cmd+, on Mac) and search for "Cline MCP":
   ```json
   {
     "cline.mcpServers": [
       {
         "name": "xaue-mcp-server",
         "command": "uvx",
         "args": ["--from", "git+https://github.com/xauecom/xaue-mcp-server", "xaue-mcp-server"]
       }
     ]
   }
   ```

3. **Restart Cline** in VS Code:
   - Use the Cline sidebar panel
   - Click the restart button or close/reopen the panel

4. **Verify the connection** in a Cline chat:
   > "What's the XAUE/XAUT exchange rate?"

### Troubleshooting Cline / VS Code

**Issue: "Server not available"**
- Verify settings are in `.vscode/settings.json` or VS Code User Settings
- Ensure `uvx` is in your system PATH: `which uvx` (Mac/Linux) or `where uvx` (Windows)
- Try running manually: `uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server`

**Issue: Settings not taking effect**
- Reload VS Code window: Cmd+Shift+P → "Developer: Reload Window"
- Check that JSON syntax is valid (no trailing commas)
- Restart the Cline extension

**Issue: Permission denied errors**
- On macOS/Linux, ensure Python scripts are executable
- Run: `chmod +x ~/.local/bin/uvx` (if applicable)
- Try: `python3 -m uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server`

---

## Generic Agent SDK (JavaScript/Python)

For custom agents built with the Agent SDK, configure MCP server startup directly in code.

### JavaScript/TypeScript Example

```javascript
import { Client } from "@anthropic-ai/sdk";
import { spawn } from "child_process";

// Start the MCP server process
const mcpProcess = spawn("uvx", [
  "--from",
  "git+https://github.com/xauecom/xaue-mcp-server",
  "xaue-mcp-server"
]);

// Handle server output
mcpProcess.stdout.on("data", (data) => {
  console.log(`[MCP Server] ${data}`);
});

mcpProcess.stderr.on("data", (data) => {
  console.error(`[MCP Server Error] ${data}`);
});

// Initialize Claude client
const client = new Client({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Make requests with MCP tools available
const response = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "What's the XAUE/XAUT exchange rate?"
    }
  ]
});
```

### Python Example

```python
import subprocess
import os
from anthropic import Anthropic

# Start the MCP server process
mcp_process = subprocess.Popen(
    ["uvx", "--from", "git+https://github.com/xauecom/xaue-mcp-server", "xaue-mcp-server"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Initialize Claude client
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Make requests with MCP tools available
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": "What's the XAUE/XAUT exchange rate?"
        }
    ]
)

print(response.content[0].text)

# Clean up
mcp_process.terminate()
```

### Configuration

For custom SDKs, ensure:
1. MCP server is started before sending requests
2. Server has finished initializing (listen for "Ready" message in stdout)
3. Claude API requests include tool definitions from MCP server

---

## Verification Steps

After setup on any platform, verify the MCP connection:

### Test 1: Basic Query

Ask Claude or Cline:
```
What's the XAUE/XAUT exchange rate?
```

Expected response: Current exchange rate data from the MCP server.

### Test 2: Tool Availability

Ask Claude or Cline:
```
What tools do you have available?
```

You should see `xaue-mcp-server` listed in the available tools.

### Test 3: Direct Command (Command Line)

Run the server directly:
```bash
uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server
```

Expected output: Server starts and logs indicate it's ready to receive requests.

---

## Troubleshooting Guide

### Common Issues

#### 1. "uvx command not found"

**Cause:** uvx is not installed or not in your system PATH.

**Solution:**
```bash
# Install uv (Python package manager)
pip install uv

# Or upgrade if already installed
pip install --upgrade uv

# Verify installation
uvx --version
```

#### 2. "Tool not found" or "Server not responding"

**Cause:** MCP server hasn't initialized or network issues.

**Solution:**
- Wait 3-5 seconds after starting the agent (server needs to initialize)
- Check internet connection (server downloads from GitHub)
- Try running the server manually: `uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server`
- Check for error messages in startup logs

#### 3. "git+ URL not recognized"

**Cause:** Old version of uvx that doesn't support git URLs.

**Solution:**
```bash
# Upgrade uv
pip install --upgrade uv

# Or install specific version
pip install "uv>=0.1.35"
```

#### 4. JSON Configuration Errors

**Cause:** Invalid JSON syntax in `.mcp.json` or settings files.

**Solution:**
- Validate JSON: use https://jsonlint.com/
- Common mistakes:
  - Trailing commas: `"args": [...],` ❌
  - Missing quotes: `command: uvx` ❌
  - Unescaped backslashes: `"path": "C:\Users\..."` ❌

#### 5. Slow Performance

**Cause:** Network delays or server reinitialization.

**Solution:**
- First query after startup is slowest
- Subsequent queries are faster (cached)
- Check network latency: `ping github.com`
- Try running on faster network if available

#### 6. Permission Denied (macOS/Linux)

**Cause:** Python executable not in PATH or permission issues.

**Solution:**
```bash
# Find Python location
which python3

# Add to .mcp.json or settings as full path
# Example: "/usr/local/bin/python3"

# Or try with python3 -m
python3 -m uvx --from git+https://github.com/xauecom/xaue-mcp-server xaue-mcp-server
```

### Getting Help

If issues persist:
1. Check MCP server repository: https://github.com/xauecom/xaue-mcp-server/issues
2. Verify Python version (3.10+): `python3 --version`
3. Check for network proxies or firewalls blocking GitHub access
4. Review agent logs for detailed error messages
5. Try on a different network or machine to isolate the issue

---

## Environment Variables (Optional)

You can customize MCP server behavior with environment variables.

### Setting Environment Variables

**Claude Code / Cline:**

Modify `.mcp.json` (Claude Code) or VS Code settings to pass environment:
```json
{
  "mcpServers": {
    "xaue-mcp-server": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/xauecom/xaue-mcp-server", "xaue-mcp-server"],
      "env": {
        "CUSTOM_VAR": "value"
      }
    }
  }
}
```

**Generic SDK:**

Pass environment to subprocess:
```python
os.environ["CUSTOM_VAR"] = "value"
mcp_process = subprocess.Popen([...], env=os.environ)
```

---

## Platform-Specific Notes

### macOS

- Ensure Python is installed via Homebrew or official installer
- If using arm64 (Apple Silicon), Python must be arm64-compatible
- Check: `python3 -c "import platform; print(platform.machine())"`

### Linux

- Ubuntu/Debian: `sudo apt-get install python3 python3-pip`
- Fedora: `sudo dnf install python3 python3-pip`
- Ensure `~/.local/bin` is in your PATH: `echo $PATH`

### Windows

- Install Python from https://www.python.org (check "Add to PATH")
- Use Command Prompt or PowerShell (not Git Bash)
- Replace `python3` with `python` in commands if needed
- Verify: `python --version`

---

## Next Steps

Once MCP is set up and verified:
1. Return to the main `SKILL.md` documentation
2. Explore available queries in `references/queries.md`
3. Try example questions to familiarize yourself with the data available
4. Review `SKILL.tests.yaml` for test cases and expected outputs
