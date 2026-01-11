/**
 * Abstract storage interface for project persistence
 */
export interface StorageAdapter {
  /**
   * Save project data to storage
   * @param projectId Unique identifier for the project
   * @param data Project data to save
   */
  save(projectId: string, data: any): Promise<void>;

  /**
   * Load project data from storage
   * @param projectId Unique identifier for the project
   * @returns Project data or null if not found
   */
  load(projectId: string): Promise<any | null>;

  /**
   * List all saved project IDs
   * @returns Array of project IDs
   */
  list(): Promise<string[]>;

  /**
   * Delete a project from storage
   * @param projectId Unique identifier for the project
   */
  delete(projectId: string): Promise<void>;

  /**
   * Check if a project exists in storage
   * @param projectId Unique identifier for the project
   * @returns True if project exists
   */
  exists(projectId: string): Promise<boolean>;
}
