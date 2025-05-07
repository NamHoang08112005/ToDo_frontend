import axios from 'axios';

const REACT_BASE_URL='http://localhost:5000'; // Có cách nào lưu ko 

if (!REACT_BASE_URL) {
    throw new Error('REACT_BASE_URL is not defined');
}

const getAllToDo = async(setToDo:any) => {
    
    axios
    .get(REACT_BASE_URL)
    .then(({data}) => {
        console.log('data --->', data);
        setToDo(data);    
    })
    .catch((error) => {  
      console.error('Error fetching todos:', error);
    });
}


const addToDo = async (text:string,setText:any,setToDo:any) => {
    if (!text) {
        alert('Please enter a todo item.');
        return;
    }
    axios
    .post(REACT_BASE_URL, {text})
    .then(({data}) => {
        console.log('data --->', data);
        setText('');
        getAllToDo(setToDo);   
    })
}

const deleteToDo = async (_id:string,setToDo:any) => {
    if (!_id) {
        alert('Please enter a todo item.');
        return;
    }
    axios
    .delete(REACT_BASE_URL, {data: { _id: _id }})
    .then(({data}) => {
        console.log('data --->', data);
        getAllToDo(setToDo);   
    })
}

const change_mode = async (_id:string, set_Updating_id:any) => {
    if (!_id) {
        alert('Please enter a todo item.');
        return;
    }
    
    set_Updating_id((prev: string[]) => [...prev, _id]);
}

const cancel = async (_id:string, set_Updating_id:any) => {
    if (!_id) {
        alert('Please enter a todo item.');
        return;
    }
    
    set_Updating_id((prev: string[]) => prev.filter(id => id !== _id));
}

const save_update = async (_id:string, text:string, set_Updating_id:any, setToDo:any) => {
    if (!_id) {
        alert('Please enter a todo item.');
        return;
    }
    
    if (!text) {
        alert('Please enter a todo item.');
        return;
    }
    
    axios
    .put(REACT_BASE_URL, { _id: _id, text: text })
    .then(({data}) => {
        console.log('data --->', data);
        set_Updating_id((prev: string[]) => prev.filter(id => id !== _id));
        getAllToDo(setToDo);   
    })
}



export {getAllToDo, addToDo, deleteToDo, change_mode, cancel, save_update};

// module.exports  return reference to the object that is being exported.
// exports creates a new object and assigns it to the module.exports property.

