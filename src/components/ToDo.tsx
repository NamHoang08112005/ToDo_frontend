import React from 'react'
import { AiFillDelete } from 'react-icons/ai'
import { BiEdit } from 'react-icons/bi'
import { FaCheckCircle } from "react-icons/fa";
import { MdCancel } from "react-icons/md";
const BiEditIcon = BiEdit as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const AiFillDeleteIcon = AiFillDelete as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const FaCheckCircleIcon = FaCheckCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const MdCancelIcon = MdCancel as unknown as React.FC<React.SVGProps<SVGSVGElement>>;

type ToDo_Props = {
  text: string;
  updateMode: any;
  deleteToDo: any;
}

const ToDo = ({text, updateMode, deleteToDo}:ToDo_Props) => {
  return (
    <div className="todo">
        <div className="text">{text}</div>
        <div className="icons">
          <BiEditIcon className='icon' onClick={updateMode}/>
          <AiFillDeleteIcon className='icon' onClick={deleteToDo}/>
        </div>
    </div>
  )
}


type Updating_Props = {
  old_item: any;
  save_update: any;
  cancel: any;
  set_Updating_id: any;
  setToDo: any;
}

const Updating_ToDo = ({old_item,save_update,cancel,set_Updating_id,setToDo}:Updating_Props) => {
  const [Updating_text, set_Updating_text] = React.useState<string>(old_item.text);
  return (
    <div className="update-todo">
        <input 
        type="text" 
        placeholder='Changing...'
        value={Updating_text}
        onChange={(e) => set_Updating_text(e.target.value)}/>
        <div className="icons">
          <FaCheckCircleIcon className='icon' onClick={()=>save_update(old_item._id,Updating_text,set_Updating_id,setToDo)}/>
          <MdCancelIcon className='icon' onClick={()=>cancel(old_item._id,set_Updating_id)}/>
        </div>
    </div>
  )
}

export {ToDo, Updating_ToDo}
