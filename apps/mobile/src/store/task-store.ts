import { create } from 'zustand';

export interface Task {
  id: string;
  store_id: string;
  store_name: string;
  store_address: string;
  rep_id: string;
  action: string;
  action_detail: string;
  priority: number; // 0-100
  status: 'pending' | 'completed' | 'skipped' | 'in_progress';
  reward_points: number;
  ai_reasoning: string;
  estimated_impact: string;
  category: 'visit' | 'order' | 'collection' | 'merchandising' | 'coaching';
  due_date: string;
  completed_at: string | null;
  created_at: string;
}

interface TaskState {
  tasks: Task[];
  completedToday: number;
  skippedToday: number;
  totalPointsToday: number;
  filterStatus: 'all' | 'pending' | 'completed' | 'skipped';
  isLoading: boolean;
  lastFetched: string | null;

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  completeTask: (taskId: string) => void;
  skipTask: (taskId: string, reason?: string) => void;
  setFilterStatus: (status: 'all' | 'pending' | 'completed' | 'skipped') => void;
  setLoading: (loading: boolean) => void;
  getFilteredTasks: () => Task[];
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  completedToday: 0,
  skippedToday: 0,
  totalPointsToday: 0,
  filterStatus: 'all',
  isLoading: false,
  lastFetched: null,

  setTasks: (tasks) => {
    const completedToday = tasks.filter((t) => t.status === 'completed').length;
    const skippedToday = tasks.filter((t) => t.status === 'skipped').length;
    const totalPointsToday = tasks
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.reward_points, 0);

    set({
      tasks,
      completedToday,
      skippedToday,
      totalPointsToday,
      lastFetched: new Date().toISOString(),
      isLoading: false,
    });
  },

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  completeTask: (taskId) =>
    set((state) => {
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() }
          : t
      );
      const task = state.tasks.find((t) => t.id === taskId);
      const pointsEarned = task?.reward_points ?? 0;

      return {
        tasks: updatedTasks,
        completedToday: state.completedToday + 1,
        totalPointsToday: state.totalPointsToday + pointsEarned,
      };
    }),

  skipTask: (taskId, _reason) =>
    set((state) => {
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'skipped' as const, completed_at: new Date().toISOString() }
          : t
      );

      return {
        tasks: updatedTasks,
        skippedToday: state.skippedToday + 1,
      };
    }),

  setFilterStatus: (filterStatus) =>
    set({ filterStatus }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  getFilteredTasks: () => {
    const { tasks, filterStatus } = get();
    if (filterStatus === 'all') return tasks;
    return tasks.filter((t) => t.status === filterStatus);
  },

  reset: () =>
    set({
      tasks: [],
      completedToday: 0,
      skippedToday: 0,
      totalPointsToday: 0,
      filterStatus: 'all',
      isLoading: false,
      lastFetched: null,
    }),
}));
