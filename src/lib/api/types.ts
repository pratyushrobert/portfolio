export interface Timestamps {
  created_at: number;
  updated_at: number;
}

export interface Entity extends Timestamps {
  id: string;
}
