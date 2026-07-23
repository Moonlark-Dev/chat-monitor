# Chat Monitor

A web-based real-time chat viewer for [Moonlark](https://github.com/Moonlark-Dev/Moonlark). Monitor chats, notes, and EGO state through a clean WebSocket-powered interface.

## Features

- **Real-time session monitoring** - WebSocket connection with fallback to REST polling
- **QQ-style chat interface** - Split view showing received/sent messages, events, and tool calls
- **Session state tracking** - See parsing/replying/idle state for each session
- **Notes management** - Create, edit, delete, and search notes
- **EGO dashboard** - View Moonlark's sleep state, mood, decision history, and agent events
- **Secure** - Token-based authentication (SHA-256), stored in localStorage

## Tech Stack

- Vue 3 + TypeScript + Vite
- Pinia (state management)
- Vue Router
- Axios (HTTP client)
- Custom CSS (dark theme)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Configuration

1. Ensure the Moonlark backend has the `nonebot_plugin_chat_monitor` plugin enabled
2. Set `status_report_password` in Moonlark's `.env`
3. Open Chat Monitor, enter the backend URL (e.g., `http://192.168.1.100:8080`) and the access token

## Screenshots

_Coming soon_

## License

AGPL-3.0
