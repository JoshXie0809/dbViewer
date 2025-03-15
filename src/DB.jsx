import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import dbicon from "./assets/database.svg"
import {VariableSizeList as VList} from "react-window"

function DB({path}) {
  const [connFinished, setConnFinished] = useState(false);
  const [chooseTBL, setChooseTBL] = useState("");
  const [colWidth, setColWidth] = useState(null);


    useEffect(() => 
      {
        async function connDB(path) {
          try {
            await invoke("db_init_conn", {path}); 
            // success
            console.log(path, "loaded!");
          } 
          catch (error) { console.error("error while attach db/db_colnames;", error); }
        }

        async function init() {
          if (path !== "") {
            console.log("init db connect to", path);
            await connDB(path);
            setConnFinished(true)
         }
        }
        init()   
      }, [path])

    if(path === "") return <div></div>;
    if(!connFinished) return <div></div>;

    return (
      <div className="database"> 
        <LoadTbList path={path} setChooseTBL={setChooseTBL}/>
          <div className="database-table-content-data"> 
            <LoadTableColnames 
              connFinished={connFinished} 
              chooseTBL={chooseTBL}
              colWidth={colWidth} />
            <LoadTableData 
              chooseTBL={chooseTBL} 
              colWidth={colWidth} 
              setColWidth={setColWidth}/>
          </div>
      </div> )
}

function LoadTableColnames({connFinished, chooseTBL, colWidth}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [dbColnames, setDBColnames] = useState("");

  useEffect(() => { 
    async function fetchData() {
      try 
      { 
        if(chooseTBL !== "") {
          const res_colnames = await invoke("db_tbl_colnames", {tblname: chooseTBL});
          setDBColnames(res_colnames);
          setIsLoaded(true);
        }
        
      } 
      catch (error) 
      {  console.error("error while attach db/db_colnames;", error); }  
    }
    if(connFinished) fetchData();
    
  }, [connFinished, chooseTBL])
  
  if(isLoaded && connFinished && (chooseTBL !== "") && colWidth) return (
  <div className="row col-header" key="tbl-colnames" style={{width: "calc(100% - 15px)"}}> 
    {
        dbColnames.map((colName, iCol) => {
            return <p className="header-cell" 
                      key={`row-0-${iCol}`}
                      style={{width: colWidth[iCol]}} > {colName} </p>
        })
    } 
  </div>
  )
}

function LoadTableData({chooseTBL, colWidth, setColWidth}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [dbData, setDBData] = useState(null);

  const listRef = useRef(null);
  const rowHeights = useRef({}); // 用來存每一 row 的 height

  useEffect(() => {
    // 重置高度資訊
    rowHeights.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0, true);
    }
    console.log(chooseTBL)
    // 進行資料抓取...
  }, [chooseTBL]);

  const getRowHeight = (index) => {
    return rowHeights.current[index] || 24 // default height 16px
  }

  const setRowHeight = (index, height) => {
    if (rowHeights.current[index] !== height) {
      listRef.current?.resetAfterIndex(index, true);
      rowHeights.current[index] = height;
    }
  };

  // render each row, and set height
  const Row = ({ index, style }) => {
    const rowRef = useRef(null);
    const [measured, setMeasured] = useState(false);

    useEffect(() => {
      const rectHeight = rowRef.current?.getBoundingClientRect().height;
      const fullHeight = rowRef.current?.scrollHeight;
      if (rectHeight > 0) {
        setRowHeight(index, fullHeight);    
        setMeasured(true); // ✅ 確保只測量一次
      }
    }, [measured, setMeasured, index, setRowHeight]);


    return (
        <div ref={rowRef} className="row" style={{...style}}>
          {dbData[index].map((val, val_id) => (
            <p key={`row-${index}-${val_id}`} 
              style={{ width: colWidth[val_id]}}>
              {val}
            </p>
          ))}
        </div>
    );
  };

  useEffect(() => { 
    async function fetchData() {
      try 
      { 
        if(chooseTBL !== "") {
          const res_obj = await invoke("db_tbl_data", {tblname: chooseTBL});
          setColWidth(res_obj.col_width);
          setDBData(res_obj.data);
          setIsLoaded(true);
        }
      } 
      catch (error) 
      {  console.error("error while attach db/db_colnames;", error); }  
    }
    setIsLoaded(false)
    if(chooseTBL !== "") fetchData();
  }, [chooseTBL])


  if(dbData && isLoaded && (chooseTBL !=="")  ) return (
      <VList
        key={chooseTBL}  // 每次 table 切換時重新渲染 VList
        ref={listRef}
        itemCount={dbData.length}
        itemSize={(index) => getRowHeight(index)} // 動態高度
        height={600} // 可視範圍高度
        overscanCount={50} // preload road
      >
        {Row}
      </VList>
  );
};



function LoadTbList({path, setChooseTBL}) {
  const [tbLists, setTBLists] = useState(null);

  useEffect(() => {
    async function get_tbl_lists() {
      const tbl_lists = await invoke("db_tbl_lists");
      setTBLists(tbl_lists)
    }
    get_tbl_lists();
  }, [path])

  if(!tbLists) return <div className="database-table-lists"></div>
  return <div className="database-table-lists">
    {
      tbLists.map((tbln, tblnID) => 
        <div 
          key={`tbl_name_list-${tblnID}`}
          onClick={() => {setChooseTBL(tbln)}}
        >
          <TableIcon/>
          {tbln}
        </div> 
      )
    }
  </div>
}

export function LoadPathBotton({path, setPath}) {
  async function handleClick() {
    const file = await open(
      {multiple: false}
    )
    setPath(file)
  }
  let dbfile = "";
  if(path === "") {dbfile = "none" }
  else {dbfile = path}

  return <div className="load-file">
    <button onClick={handleClick}>load</button>
      <img src={dbicon} width={25} height={25} alt="Database Icon"/>
      <span className="load-path">{`load file: ${dbfile}`}</span>
    </div>
}

function TableIcon() {
  return <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
  >
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" strokeWidth="2" />
  </svg>
}


export default DB;