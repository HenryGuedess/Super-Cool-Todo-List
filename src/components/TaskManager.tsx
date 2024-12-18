import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { AlertCircle, Clock, Play, Square, Download, Upload, Trash2 } from 'lucide-react';

interface Task {
  id: string;
  name: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  category: string;
  completed: boolean;
  timeSpent: number;
  duration: number; // Duration in minutes
  timerRunning: boolean;
}

const TaskManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'overdue' | 'completed'>('today');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      return JSON.parse(savedTasks, (key, value) => {
        if (key === 'dueDate') {
          return new Date(value);
        }
        return value;
      });
    }
    return [];
  });
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({});
  const [hourlyRate, setHourlyRate] = useState<number>(() => {
    const savedRate = localStorage.getItem('hourlyRate');
    return savedRate ? parseFloat(savedRate) : 0;
  });
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    priority: '',
    category: '',
    date: '',
  });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null); // Track the currently active task
  const [elapsedTime, setElapsedTime] = useState<number>(0); // Track elapsed time for the active task

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('hourlyRate', hourlyRate.toString());
  }, [hourlyRate]);

  const filteredTasks = useMemo(() => {
    const applyFilters = (tasks: Task[]) => {
      return tasks.filter(task => 
        (filters.priority === '' || task.priority === filters.priority) &&
        (filters.category === '' || task.category === filters.category) &&
        (filters.date === '' || format(task.dueDate, 'yyyy-MM-dd') === filters.date)
      );
    };

    return {
      today: applyFilters(tasks.filter(task => isToday(task.dueDate) && !task.completed)),
      tomorrow: applyFilters(tasks.filter(task => isTomorrow(task.dueDate) && !task.completed)),
      overdue: applyFilters(tasks.filter(task => isPast(task.dueDate) && !isToday(task.dueDate) && !task.completed)),
      completed: applyFilters(tasks.filter(task => task.completed)),
    };
  }, [tasks, filters]);

  const addTask = () => {
    if (newTask.name && newTask.priority) {
      const task: Task = {
        id: Date.now().toString(),
        name: newTask.name,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : new Date(),
        priority: newTask.priority as 'low' | 'medium' | 'high',
        category: newTask.category || '',
        completed: false,
        timeSpent: 0,
        duration: newTask.duration || 0,
        timerRunning: false,
      };
      setTasks(prevTasks => {
        const updatedTasks = [...prevTasks, task];
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        return updatedTasks;
      });
      setNewTask({});
      setIsAddTaskModalOpen(false);
    } else {
      console.log("Nome da tarefa e prioridade são obrigatórios");
    }
  };

  const toggleTimer = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          // If the task is being activated, stop any currently active task
          if (activeTaskId && activeTaskId !== taskId) {
            const previousTask = prevTasks.find(t => t.id === activeTaskId);
            if (previousTask) {
              previousTask.timerRunning = false; // Stop the previous task
            }
          }
          setActiveTaskId(taskId); // Set the active task
          return { ...task, timerRunning: !task.timerRunning };
        }
        return { ...task, timerRunning: false }; // Stop other tasks
      })
    );
  }, [activeTaskId]);

  const toggleTaskCompletion = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  }, []);

  const deleteTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    setDeleteTaskId(null);
  };

  const playAlarm = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createOscillator = (freq: number) => {
      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      return osc;
    };

    const createGain = () => {
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0, audioContext.currentTime);
      return gain;
    };

    const playBeep = (time: number, freq: number, duration: number) => {
      const osc = createOscillator(freq);
      const gain = createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.start(time);
      osc.stop(time + duration);
    };

    const now = audioContext.currentTime;
    for (let i = 0; i < 10; i++) {
      playBeep(now + i * 0.3, 880, 0.1);
      playBeep(now + i * 0.3 + 0.1, 660, 0.1);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.timerRunning) {
            const newTimeSpent = task.timeSpent + 1;
            const halfTime = task.duration * 30; // Metade do tempo em segundos
            const fullTime = task.duration * 60; // Tempo total em segundos

            if (newTimeSpent === halfTime || newTimeSpent === fullTime) {
              playAlarm();
            }

            return { ...task, timeSpent: newTimeSpent };
          }
          return task;
        })
      );

      // Update elapsed time for the active task
      if (activeTaskId) {
        const activeTask = tasks.find(task => task.id === activeTaskId);
        if (activeTask) {
          setElapsedTime(activeTask.timeSpent);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTaskId, tasks]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number): string => {
    return `${minutes}min`;
  };

  const calculateCost = (timeSpent: number) => {
    return ((hourlyRate / 3600) * timeSpent).toFixed(2);
  };

  const getPriorityIcon = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'low':
        return <AlertCircle className="text-green-500" size={16} />;
      case 'medium':
        return <AlertCircle className="text-yellow-500" size={16} />;
      case 'high':
        return <AlertCircle className="text-red-500" size={16} />;
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return; // Se não houver destino, não faz nada
    }

    const items = Array.from(tasks); // Cria uma cópia do estado atual das tarefas
    const [reorderedItem] = items.splice(result.source.index, 1); // Remove a tarefa da posição original
    items.splice(result.destination.index, 0, reorderedItem); // Insere a tarefa na nova posição

    setTasks(items); // Atualiza o estado com a nova ordem das tarefas
  };

  const exportToCSV = () => {
    const headers = [
      'Task Name',
      'Priority',
      'Category',
      'Task Due',
      'Time (programado para finalizar)',
      'Time finished (tempo que foi finalizada)',
      'Money USD'
    ];

    const csvContent = tasks.map(task => [
      task.name,
      task.priority,
      task.category,
      format(task.dueDate, 'yyyy-MM-dd'),
      formatTime(task.duration * 60),
      formatTime(task.timeSpent),
      calculateCost(task.timeSpent)
    ]);

    const csvData = [headers, ...csvContent].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'tasks.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim() !== ''); // Remove linhas em branco
        const newTasks: Task[] = lines.slice(1).map(line => {
          const [name, priority, category, dueDate, duration, timeSpent] = line.split(',');
          return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name,
            priority: priority as 'low' | 'medium' | 'high',
            category,
            dueDate: new Date(dueDate), // Certifique-se de que a data está no formato correto
            duration: parseInt(duration.split(':')[0]) * 60 + parseInt(duration.split(':')[1]),
            timeSpent: parseInt(timeSpent.split(':')[0]) * 3600 + parseInt(timeSpent.split(':')[1]) * 60 + parseInt(timeSpent.split(':')[2]),
            completed: false,
            timerRunning: false
          };
        });

        // Atualiza o estado das tarefas
        setTasks(prevTasks => {
          const updatedTasks = [...prevTasks, ...newTasks];
          localStorage.setItem('tasks', JSON.stringify(updatedTasks)); // Salva as tarefas no localStorage
          return updatedTasks;
        });
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">Move Faster, Don't Stop!</h1>
        
        <div className="mb-4">
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-300">
            Hourly Rate (USD)
          </label>
          <input
            id="hourlyRate"
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(parseFloat(e.target.value))}
            className="mt-1 block rounded-md bg-gray-800 border-gray-700 text-white p-2"
          />
        </div>

        <div className="text-xl md:text-2xl font-bold mb-4">
          Timer: {formatTime(elapsedTime)} - {activeTaskId ? formatDuration(tasks.find(task => task.id === activeTaskId)?.duration || 0) : '0min'} 
          <span className="text-green-500">
            {activeTaskId ? ` - $${calculateCost(elapsedTime)}` : ''}
          </span>
        </div>

        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 mb-4">
          <button
            onClick={() => setIsAddTaskModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors w-full md:w-auto"
          >
            Add New Task
          </button>
          <button
            onClick={exportToCSV}
            className="px-2 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center w-full md:w-auto"
          >
            <Download size={16} className="mr-2" />
            Export to CSV
          </button>
          <label className="px-2 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center w-full md:w-auto cursor-pointer">
            <Upload size={16} className="mr-2" />
            Import from CSV
            <input
              type="file"
              accept=".csv"
              onChange={importFromCSV}
              className="hidden"
            />
          </label>
        </div>

        <div className="bg-gray-900 rounded-lg shadow-lg p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-semibold mb-4">Tasks</h2>
          <div className="mb-4">
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
              {['today', 'tomorrow', 'overdue', 'completed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as 'today' | 'tomorrow' | 'overdue' | 'completed')}
                  className={`px-4 py-2 rounded-md w-full md:w-auto ${
                    activeTab === tab
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} 
                  {/* Add notification count */}
                  <span className="ml-2 text-sm text-gray-400">
                    ({filteredTasks[tab].length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="bg-gray-800 text-white rounded-md p-1 text-sm w-full md:w-auto"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="bg-gray-800 text-white rounded-md p-1 text-sm w-full md:w-auto"
            >
              <option value="">None</option>
              {Array.from(new Set(tasks.map(task => task.category))).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="bg-gray-800 text-white rounded-md p-1 text-sm w-full md:w-auto"
            />
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="tasks">
              {(provided) => (
                <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {filteredTasks[activeTab].map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-gray-800 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-grow">
                              <div className="flex items-center mb-2">
                                <h3 className="text-lg font-semibold mr-2">{task.name}</h3>
                                {getPriorityIcon(task.priority)}
                              </div>
                              <p className="text-sm text-gray-400 mb-1">Due: {format(task.dueDate, 'yyyy-MM-dd')}</p>
                              {task.category && <p className="text-sm text-gray-400 mb-1">Category: {task.category}</p>}
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <Clock className="text-blue-500" size={16} />
                                <span className="text-sm">
                                  {formatTime(task.timeSpent)} / {formatTime(task.duration * 60)}
                                </span>
                                <span className="text-sm text-green-500">
                                  ${calculateCost(task.timeSpent)}
                                </span>
                              </div>
                              <button
                                className="p-1 rounded-full hover:bg-gray-700 transition-colors"
                                onClick={() => toggleTimer(task.id)}
                              >
                                {task.timerRunning ? <Square size={16} /> : <Play size={16} />}
                              </button>
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => toggleTaskCompletion(task.id)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <button
                                className="p-1 rounded-full hover:bg-gray-700 transition-colors"
                                onClick={() => setDeleteTaskId(task.id)}
                              >
                                <Trash2 size={16} className="text-red-500" />
                              </button>
                            </div>
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {isAddTaskModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Add New Task</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newTask.name || ''}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white p-2"
                  />
                </div>
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-300">
                    Duration (minutes)
                  </label>
                  <input
                    id="duration"
                    type="number"
                    value={newTask.duration || ''}
                    onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white p-2"
                  />
                </div>
                <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-gray-300">
                    Due Date
                  </label>
                  <input
                    id="dueDate"
                    type="date"
                    value={newTask.dueDate ? format(new Date(newTask.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: new Date(e.target.value) })}
                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white p-2"
                  />
                </div>
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-300">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={newTask.priority || ''}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white p-2"
                  >
                    <option value="">Select Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-300">
                    Category
                  </label>
                  <input
                    id="category"
                    type="text"
                    value={newTask.category || ''}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white p-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTaskId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Delete Task</h2>
              <p className="mb-4">Are you sure you want to delete this task?</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setDeleteTaskId(null)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteTask(deleteTaskId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManager;
