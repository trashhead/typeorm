import type { DataSource } from "../../data-source/DataSource"
import { DriverPackageNotInstalledError, TypeORMError } from "../../error"
import { PlatformTools } from "../../platform/PlatformTools"
import type { QueryRunner } from "../../query-runner/QueryRunner"
import { AbstractSqliteDriver } from "../sqlite-abstract/AbstractSqliteDriver"
import type { ExpoDataSourceOptions } from "./ExpoDataSourceOptions"
import { ExpoQueryRunner } from "./ExpoQueryRunner"

export class ExpoDriver extends AbstractSqliteDriver {
    declare options: ExpoDataSourceOptions

    constructor(dataSource: DataSource) {
        super(dataSource)
        this.loadDependencies()
    }

    async disconnect(): Promise<void> {
        this.queryRunner = undefined
        await this.databaseConnection.closeAsync()
        this.databaseConnection = undefined
    }

    createQueryRunner(): QueryRunner {
        this.queryRunner ??= new ExpoQueryRunner(this)
        return this.queryRunner
    }

    protected async createDatabaseConnection() {
        this.databaseConnection = await this.sqlite.openDatabaseAsync(
            this.options.database,
        )
        await this.databaseConnection.runAsync("PRAGMA foreign_keys = ON")
        return this.databaseConnection
    }

    /**
     * If driver dependency is not given explicitly, resolve it via
     * `requireExpoSqlite()` and validate that the loaded module exposes the
     * modern async API introduced in Expo SDK v52.
     */
    protected loadDependencies(): void {
        if (this.options.driver) {
            this.sqlite = this.options.driver
        } else {
            try {
                this.sqlite = PlatformTools.load("expo-sqlite")
            } catch {
                throw new DriverPackageNotInstalledError(
                    "Expo SQLite",
                    "expo-sqlite",
                )
            }
        }

        // Expo SDK v52 removed the legacy synchronous API. The modern async API
        // exposes `openDatabaseAsync` as a function — anything else (missing,
        // non-callable, non-object `driver`) means the user is on a pre-v52 SDK
        // or has passed something that isn't the expo-sqlite module.
        if (typeof this.sqlite?.openDatabaseAsync !== "function") {
            const hint = this.options.driver
                ? "check that the provided `driver` exposes `openDatabaseAsync` — custom overrides must match the expo-sqlite v52+ surface"
                : "upgrade to Expo SDK v52 or later, which ships the modern async SQLite API"
            throw new TypeORMError(
                `Legacy Expo SQLite driver is not supported — ${hint}.`,
            )
        }
    }
}
