import { withDbConnection } from "../middleware"
import User, { type IUser } from "../models/user"
import { ObjectId } from "mongodb"

// Original functions wrapped with withDbConnection middleware
export const createUser = withDbConnection(async (userData: Partial<IUser>): Promise<IUser> => {
  const user = new User(userData)
  return await user.save()
})

export const getUserById = withDbConnection(async (id: string): Promise<IUser | null> => {
  return await User.findById(id)
})

export const getUserByEmail = withDbConnection(async (email: string): Promise<IUser | null> => {
  return await User.findOne({ email })
})

export const updateUser = withDbConnection(async (id: string, userData: Partial<IUser>): Promise<IUser | null> => {
  return await User.findByIdAndUpdate(id, userData, { new: true })
})

export const deleteUser = withDbConnection(async (id: string): Promise<boolean> => {
  const result = await User.deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount === 1
})

export const getUserStats = withDbConnection(async (id: string): Promise<any> => {
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
})

