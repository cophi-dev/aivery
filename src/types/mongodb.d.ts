import { Collection, ObjectId } from 'mongodb';

export function getCollection(name: string): Promise<Collection>;
export function getDatabase(): Promise<any>;
export function dbConnect(): Promise<any>; 