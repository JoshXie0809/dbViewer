use rusqlite::types::Value;
use rusqlite::{Connection, Result};
use serde_json::{json, Value as JsonValue};
use std::cmp::max;
use std::sync::Mutex;
use tauri::State;

struct DBState {
    conn: Mutex<Option<Connection>>,
}

impl DBState {
    fn new() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }

    fn init_conn(&self, path: String) -> Result<(), String> {
        let mut guard = 
            self.conn.lock().map_err(|e| e.to_string())?;

        if guard.is_none() {
            let init_conn = 
                Connection::open(path).map_err(|e| e.to_string())?;
            *guard = Some(init_conn);
        }

        Ok(())
    }

    fn get_conn_gaurd(&self) -> Result<std::sync::MutexGuard<'_, Option<Connection>>, String>{
        let guard: std::sync::MutexGuard<'_, Option<Connection>> = 
            self.conn.lock().map_err(|e| e.to_string())?;
        Ok(guard)
    }
    // check connect or not
    fn check_gaurd(g: &std::sync::MutexGuard<'_, Option<Connection>> )
    -> Result<(), String>
    {
        match &**g {
            None => return Err("does not init db connection".to_string()),
            Some(_conn) => Ok(())
        }
    }
}

fn convert_rusql_val_to_json_val(val: Value) -> JsonValue {
    match val {
        Value::Integer(i) => JsonValue::from(i),
        Value::Text(s) => JsonValue::from(s),
        Value::Real(f) => JsonValue::from(f),
        Value::Blob(b) => JsonValue::from(b),
        Value::Null => JsonValue::Null,
    }
}

#[tauri::command]
fn db_tbl_lists(state: State<DBState>) -> Result<JsonValue, String> {
    let gaurd = state.get_conn_gaurd()?;
    DBState::check_gaurd(&gaurd)?;

    let conn = gaurd.as_ref().unwrap();
    let q: String = format!("SELECT name FROM sqlite_master WHERE type='table'");
    let mut stmt = 
        conn.prepare(&q).map_err(|e| e.to_string())?;
    let table_iter = 
        stmt.query_map([], |row| row.get::<usize, String>(0))
        .map_err(|e| e.to_string())?;
    let mut ret: Vec<String> = Vec::new();
    for tbl_name in table_iter {
        ret.push(tbl_name.map_err(|e| e.to_string())?);
    }

    Ok(json!(ret))
}

#[tauri::command]
fn db_tbl_colnames(state: State<DBState>, tblname: String) -> Result<JsonValue, String> {
    let gaurd = state.get_conn_gaurd()?;
    match &*gaurd {
        None => Err("dbconn: does not init db".to_string()),
        Some(conn) => {
            let q: String = format!("SELECT * FROM {tblname} LIMIT 1");
            let stmt: rusqlite::Statement<'_> =
                conn.prepare(q.as_str()).map_err(|e| e.to_string())?;
            let colnames: Vec<&str> = stmt.column_names();
            Ok(json!(colnames))
        }
    }
}

#[tauri::command]
fn db_tbl_data(state: State<DBState>, tblname: String) 
    -> Result<JsonValue, String> 
{
    let gaurd = state.get_conn_gaurd()?;
    DBState::check_gaurd(&gaurd)?;

    DBState::check_gaurd(&gaurd)?;
    let q: String = format!("SELECT * FROM {tblname};");
    let conn: &Connection = gaurd.as_ref().unwrap();
    let mut stmt: rusqlite::Statement<'_> = conn
                .prepare(&q)
                .map_err(|e| e.to_string())?;

    let ncol: usize = stmt.column_count();
    let mut column_width: Vec<usize> = vec![0usize; ncol];
    for i in 0..ncol {
        let coli = stmt
            .column_name(i)
            .map_err(|e| e.to_string())?
            .len();
        column_width[i] = 12 + 24 * coli;
    }

    let row_iter = stmt
        .query_map([], |row: &rusqlite::Row<'_>| {
            let mut res: Vec<JsonValue> = Vec::<JsonValue>::new();
            for i in 0..ncol {
                let val: Value = row.get(i)?;
                let jval: JsonValue = convert_rusql_val_to_json_val(val);
                let char_count = serde_json::to_string(&jval).unwrap().len();
                column_width[i] = max(column_width[i], 24 + 12 * char_count) ;
                res.push(jval);
            }
            Ok(res)
        })
        .map_err(|e| e.to_string())?;

    let ret_data: Vec<serde_json::Value> = row_iter.map(
            |row: std::result::Result<Vec<JsonValue>, rusqlite::Error>| {
                row.map(|p| serde_json::json!(p))
            },
        )
        .collect::<Result<Vec<_>, rusqlite::Error>>()
        .map_err(|e| e.to_string())?;
    
    let mut obj = serde_json::Map::new();
    obj.insert("data".to_string(), json!(ret_data));
    obj.insert("col_width".to_string(), json!(column_width));

    Ok(JsonValue::Object(obj))
}

#[tauri::command]
fn db_init_conn(state: State<DBState>, path: String) -> Result<(), String> {
    state.init_conn(path)?;
    Ok(())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state: DBState = DBState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(db_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            db_init_conn,
            db_tbl_lists,
            db_tbl_colnames,
            db_tbl_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
