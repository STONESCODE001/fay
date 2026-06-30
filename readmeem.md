import { db } from "./lib/db";
import { type AppSchema } from "./instant.schema";
import { id, type InstaQLEntity } from "@instantdb/react";

type Todo = InstaQLEntity<AppSchema, "todos">;

const room = db.room("todos");

function App() {
  // Read Data
  const { isLoading, error, data } = db.useQuery({ todos: {} });
  const { peers } = db.rooms.usePresence(room);
  const numUsers = 1 + Object.keys(peers).length;
  if (isLoading) {
    return null;
  }
  if (error) {
    return <div className="text-red-500 p-4">Error: {error.message}</div>;
  }
  const { todos } = data;
  return (
    <div className="font-mono min-h-screen flex justify-center items-center flex-col space-y-4">
      <div className="text-xs text-gray-500">
        Number of users online: {numUsers}
      </div>
      <h2 className="tracking-wide text-5xl text-gray-300">todos</h2>
      <div className="border border-gray-300 max-w-xs w-full">
        <TodoForm todos={todos} />
        <TodoList todos={todos} />
        <ActionBar todos={todos} />
      </div>
      <div className="text-xs text-center">
        Open another tab to see todos update in realtime!
      </div>
    </div>
  );
}

// Write Data
// ---------
function addTodo(text: string) {
  db.transact(
    db.tx.todos[id()].update({
      text,
      done: false,
      createdAt: Date.now(),
    }),
  );
}

function deleteTodo(todo: Todo) {
  db.transact(db.tx.todos[todo.id].delete());
}

function toggleDone(todo: Todo) {
  db.transact(db.tx.todos[todo.id].update({ done: !todo.done }));
}

function deleteCompleted(todos: Todo[]) {
  const completed = todos.filter((todo) => todo.done);
  const txs = completed.map((todo) => db.tx.todos[todo.id].delete());
  db.transact(txs);
}

function toggleAll(todos: Todo[]) {
  const newVal = !todos.every((todo) => todo.done);
  db.transact(
    todos.map((todo) => db.tx.todos[todo.id].update({ done: newVal })),
  );
}

// components/ui
// ----------
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path
        d="M5 8 L10 13 L15 8"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
      />
    </svg>
  );
}

function TodoForm({ todos }: { todos: Todo[] }) {
  return (
    <div className="flex items-center h-10 border-b border-gray-300">
      <button
        className="h-full px-2 border-r border-gray-300 flex items-center justify-center"
        onClick={() => toggleAll(todos)}
      >
        <div className="w-5 h-5">
          <ChevronDownIcon />
        </div>
      </button>
      <form
        className="flex-1 h-full"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.input as HTMLInputElement;
          addTodo(input.value);
          input.value = "";
        }}
      >
        <input
          className="w-full h-full px-2 outline-none bg-transparent"
          autoFocus
          placeholder="What needs to be done?"
          type="text"
          name="input"
        />
      </form>
    </div>
  );
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <div className="divide-y divide-gray-300">
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center h-10">
          <div className="h-full px-2 flex items-center justify-center">
            <div className="w-5 h-5 flex items-center justify-center">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={todo.done}
                onChange={() => toggleDone(todo)}
              />
            </div>
          </div>
          <div className="flex-1 px-2 overflow-hidden flex items-center">
            {todo.done ? (
              <span className="line-through">{todo.text}</span>
            ) : (
              <span>{todo.text}</span>
            )}
          </div>
          <button
            className="h-full px-2 flex items-center justify-center text-gray-300 hover:text-gray-500"
            onClick={() => deleteTodo(todo)}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
}

function ActionBar({ todos }: { todos: Todo[] }) {
  return (
    <div className="flex justify-between items-center h-10 px-2 text-xs border-t border-gray-300">
      <div>Remaining todos: {todos.filter((todo) => !todo.done).length}</div>
      <button
        className=" text-gray-300 hover:text-gray-500"
        onClick={() => deleteCompleted(todos)}
      >
        Delete Completed
      </button>
    </div>
  );
}

export default App;



























      <div className="flex m-2 gap-2">
        {/* ==================== SEND DIALOG ==================== */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Send
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Funds</DialogTitle>
              <DialogDescription>
                Enter the amount you want to transfer.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmSend} className="space-y-4 my-2">
              {/* Available Balance Readout */}
              <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                <span>Available Balance</span>
                <span className="font-semibold text-gray-700">${balance.toFixed(2)}</span>
              </div>

              {/* Input box */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-gray-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`w-full pl-8 pr-16 py-3 border-2 rounded-xl text-xl font-semibold tracking-wide outline-none transition-all
              ${error ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500' : 'border-gray-200 bg-gray-50 focus:border-primary focus:bg-white'}
            `}
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleSetPercentage(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
                >
                  MAX
                </button>
              </div>

              {error && <p className="text-xs text-red-500 font-medium px-1">⚠️ {error}</p>}

              {/* Action Buttons */}
              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={!!error || !sendAmount || parseFloat(sendAmount) <= 0}>
                  Confirm & Send
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ==================== RECEIVE DIALOG ==================== */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Receive
            </button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receive Funds</DialogTitle>
              <DialogDescription>
                Your wallet address is ready to accept transactions.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>