const WebSocket = require("ws")
const http = require("http")
const express = require("express")

const app = express()
app.use(express.json())

const clients = new Map() // Map to store clients per UUID

const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })

// Transform function (unchanged)
function getFirstElement(field, defaultValue) {
  return field && field.length > 0 ? field[0] : defaultValue
}

function transformPacket(packet) {
  return {
    timestamp: getFirstElement(packet._source.layers["frame.time"], "N/A"),
    src: getFirstElement(packet._source.layers["ip.src"], "N/A"),
    dst: getFirstElement(packet._source.layers["ip.dst"], "N/A"),
    protocol: getFirstElement(packet._source.layers["_ws.col.Protocol"], "N/A"),
    info: getFirstElement(packet._source.layers["_ws.col.Info"], "N/A"),
    geo_location: getFirstElement(packet._source.layers["ip.geoip.dst_summary"], "N/A"),
    ip_protocol: getFirstElement(packet._source.layers["ip.proto"], "N/A"),
    tcp_srcport: getFirstElement(packet._source.layers["tcp.srcport"], "N/A"),
    tcp_dstport: getFirstElement(packet._source.layers["tcp.dstport"], "N/A"),
    http_host: getFirstElement(packet._source.layers["http.host"], "N/A"),
    http_user_agent: getFirstElement(packet._source.layers["http.user_agent"], "N/A"),
    dns_qry_name: getFirstElement(packet._source.layers["dns.qry.name"], "N/A"),
    dns_a: getFirstElement(packet._source.layers["dns.a"], "N/A"),
    ws_expert_message: getFirstElement(packet._source.layers["_ws.expert.message"], "N/A"),
  }
}

// Function to broadcast messages per UUID
function broadcastToClients(uuid, packet) {
  const data = JSON.stringify(packet)
  if (clients.has(uuid)) {
    for (const client of clients.get(uuid)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    }
  }
}

// Handle WebSocket connection per UUID
server.on("upgrade", (request, socket, head) => {
  const uuid = request.url.slice(1) // Extract UUID from URL (e.g., "/843cf35d..." → "843cf35d...")

  if (!uuid) {
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    if (!clients.has(uuid)) {
      clients.set(uuid, new Set())
    }
    clients.get(uuid).add(ws)

    console.log(`Client connected on UUID: ${uuid}`)

    ws.on("message", (message) => {
      try {
        const packet = JSON.parse(message)
        const transformedData = transformPacket(packet)
        broadcastToClients(uuid, transformedData)
      } catch (error) {
        console.error("Error processing message:", error)
      }
    })

    ws.on("close", () => {
      console.log(`Client disconnected from UUID: ${uuid}`)
      clients.get(uuid).delete(ws)
      if (clients.get(uuid).size === 0) {
        clients.delete(uuid)
      }
    })
  })
})

app.post("/uuid", (req, res) => {
  const { uuid } = req.body
  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" })
  }

  console.log(`UUID received: ${uuid}. Clients can connect at ws://localhost:4000/${uuid}`)
  res.json({ message: `WebSocket route enabled for UUID: ${uuid}` })
})

const apiPort = 3000
const wsPort = 4000
app.listen(apiPort, () => console.log(`API Server running on port ${apiPort}`))
server.listen(wsPort, () => console.log(`WebSocket Server running on port ${wsPort}`))
