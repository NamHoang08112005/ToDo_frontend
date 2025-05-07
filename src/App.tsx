import {useEffect, useState} from 'react';
import logo from './logo.svg';
import {ToDo, Updating_ToDo} from './components/ToDo';
import './utils/HandleApi';
import {getAllToDo, addToDo, deleteToDo, change_mode, cancel, save_update} from './utils/HandleApi';

function voidFunction() {}




function App() {
  const [toDo, setToDo] = useState<any>([]);
  const [text, setText] = useState<string>('');
  const [Updating_id, set_Updating_id] = useState<any>([]);

  useEffect (() => {
    getAllToDo(setToDo);
  }, []);
  return (
    <div className="App">
      <div className="container">
        <h1>ToDo App</h1>
      </div> 
      <div className="top">
        <input 
        type="text" 
        placeholder='Add ToDos...'
        value={text}
        onChange={(e) => setText(e.target.value)}/>

        <div className="add" onClick={() =>addToDo(text,setText,setToDo)}>
          Add
        </div>
      </div>
      <div className="list">
        {toDo.map((item: any,index :any) => 
        Updating_id.includes(item._id) ? 
        <Updating_ToDo key={item._id} old_item={item} save_update = {save_update} cancel={cancel} set_Updating_id={set_Updating_id} setToDo={setToDo}/>
        :
        <ToDo key={item._id} text= {item.text}  updateMode={()=>change_mode(item._id,set_Updating_id)} deleteToDo= {()=>deleteToDo(item._id,setToDo)} />)}
        
      </div>
    </div>
  );
}

export default App;
