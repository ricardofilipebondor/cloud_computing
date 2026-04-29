export type Task = {
  id: string;
  title: string;
  completed: boolean;
  processed: boolean;
  fileUrl: string | null;
  createdAt: string;
};
