import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import DB, {LoadPathBotton} from "./DB.jsx";

// Text editor component with fixed size
function App() {

  const [path, setPath] = useState("");

  return (
    <div>
      <LoadPathBotton path={path} setPath={setPath}></LoadPathBotton>
      <DB path={path}></DB>
    </div>
    
  );
}

export default App;