import java.text.SimpleDateFormat
import java.util.Date

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.animira.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.animira.app"
        minSdk = 21
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"

        buildConfigField("String", "UPDATE_SERVER_URL", "\"https://animira.onrender.com\"")
        buildConfigField("String", "BUILD_TIME", "\"" + System.currentTimeMillis() + "\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
    // Note: kotlinOptions is deprecated in favor of compilerOptions,
    // but keeping for compatibility with current Gradle version

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

// Store version info for tasks
val appVersionCode = 2
val appVersionName = "1.1"

// Task to copy APK to project root
tasks.register<Copy>("copyApk") {
    // Explicit dependency on packageDebug task outputs
    from(layout.buildDirectory.dir("outputs/apk/debug"))
    into(layout.projectDirectory.dir("apk"))
    include("*.apk")
    rename { "app-debug.apk" }
}

// Task to generate version.json for the update server
tasks.register("generateVersionJson") {
    // Defer file resolution to execution phase (fixes configuration cache issue)
    doLast {
        val versionFile = layout.projectDirectory.file("apk/version.json").asFile
        val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm")
        val buildTime = dateFormat.format(Date())
        val json = """{
    "version_code": $appVersionCode,
    "version_name": "$appVersionName",
    "changelog": "Сборка от $buildTime",
    "build_time": ${System.currentTimeMillis()}
}"""
        versionFile.parentFile.mkdirs()
        versionFile.writeText(json)
        println("Generated version.json: $json")
    }
}

afterEvaluate {
    // Declare explicit dependency on packageDebug
    tasks.named("copyApk") {
        dependsOn("packageDebug")
    }
    tasks.named("assembleDebug") {
        finalizedBy("generateVersionJson")
    }
}

tasks.named("generateVersionJson") {
    dependsOn("copyApk")
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.leanback:leanback:1.0.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
