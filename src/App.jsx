import { useState } from "react";
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