import { Navigate, Route, Routes } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Debug from "./pages/Debug"
import Landing from "./pages/Landing"
import Login from "./pages/Login"

function App() {
	return (
		<div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900 flex flex-col">
			<Routes>
				<Route path="/" element={<Landing />} />
				<Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
				<Route path="/about" element={<Navigate to="/#about" replace />} />
				<Route path="/connect" element={<Login />} />
				<Route path="/app/:profileId" element={<Dashboard />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</div>
	)
}

export default App
