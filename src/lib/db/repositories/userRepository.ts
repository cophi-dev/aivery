import dbConnect from "../mongoose"
import User, { type IUser } from "../models/user"
import { ObjectId } from "mongodb"

export async function createUser(userData: Partial<IUser>): Promise<IUser> {
  await dbConnect()
  const user = new User(userData)
  return await user.save()
}

export async function getUserById(id: string): Promise<IUser | null> {
  await dbConnect()
  return await User.findById(id)
}

export async function getUserByEmail(email: string): Promise<IUser | null> {
  await dbConnect()
  return await User.findOne({ email })
}

export async function updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
  await dbConnect()
  return await User.findByIdAndUpdate(id, userData, { new: true })
}

export async function deleteUser(id: string): Promise<boolean> {
  await dbConnect()
  const result = await User.deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount === 1
}

export async function getUserStats(id: string): Promise<any> {
  await dbConnect()
  const user = await User.findById(id)
  if (!user) return null

  return {
    height: user.height,
    weight: user.weight,
    age: user.age,
    gender: user.gender,
    activityLevel: user.activityLevel,
    goals: user.goals,
  }
}

