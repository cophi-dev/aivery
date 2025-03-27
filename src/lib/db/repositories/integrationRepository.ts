import dbConnect from "../mongodb"
import Integration, { type IIntegration } from "../models/integration"
import { ObjectId } from "mongodb"

export async function createIntegration(integrationData: Partial<IIntegration>): Promise<IIntegration> {
  await dbConnect()
  const integration = new Integration(integrationData)
  return await integration.save()
}

export async function getIntegrationById(id: string): Promise<IIntegration | null> {
  await dbConnect()
  return await Integration.findById(id)
}

export async function getIntegrationByUserAndProvider(userId: string, provider: string): Promise<IIntegration | null> {
  await dbConnect()
  return await Integration.findOne({ userId: new ObjectId(userId), provider })
}

export async function updateIntegration(
  id: string,
  integrationData: Partial<IIntegration>,
): Promise<IIntegration | null> {
  await dbConnect()
  return await Integration.findByIdAndUpdate(id, integrationData, { new: true })
}

export async function deleteIntegration(id: string): Promise<boolean> {
  await dbConnect()
  const result = await Integration.deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount === 1
}

export async function updateLastSynced(id: string, lastSynced: Date): Promise<IIntegration | null> {
  await dbConnect()
  return await Integration.findByIdAndUpdate(id, { lastSynced }, { new: true })
}

export async function getUserIntegrations(userId: string): Promise<IIntegration[]> {
  await dbConnect()
  return await Integration.find({ userId: new ObjectId(userId) })
}

