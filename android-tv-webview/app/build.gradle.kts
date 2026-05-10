plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Auto-increment version based on build time
val buildTime = System.currentTimeMillis()
val versionCodeAuto = (buildTime / 1000).toInt()  // Seconds since epoch
val versionNameAuto = java.time.LocalDateTime.now().format(
    java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd.HHmm")
)

android {
    namespace = "com.animira.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.animira.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = versionCodeAuto
        versionName = versionNameAuto

        buildConfigField("String", "UPDATE_SERVER_URL", "\"https://animira.onrender.com\"")
    }

    buildFeatures {
        buildConfig = true
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

    applicationVariants.all {
        val variant = this
        variant.outputs.all {
            val output = this as com.android.build.gradle.internal.api.ApkVariantOutputImpl
            output.outputFileName = "app-debug.apk"
        }
    }

    // Копируем APK после сборки и генерируем version.json
    tasks.matching { it.name == "packageDebug" }.configureEach {
        finalizedBy("copyApk", "generateVersionJson")
    }

    tasks.register<Copy>("copyApk") {
        from(layout.buildDirectory.dir("outputs/apk/debug")) {
            include("app-debug.apk")
        }
        into(layout.projectDirectory.dir("../apk"))
    }
    
    // Генерируем version.json для сервера
    tasks.register("generateVersionJson") {
        doLast {
            val versionFile = layout.projectDirectory.file("../apk/version.json").asFile
            versionFile.parentFile.mkdirs()
            
            val json = """
                {
                    "version_code": $versionCodeAuto,
                    "version_name": "$versionNameAuto",
                    "changelog": "Сборка от ${java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))}",
                    "build_time": $buildTime
                }
            """.trimIndent()
            
            versionFile.writeText(json)
            println("Generated version.json: $versionCodeAuto / $versionNameAuto")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.leanback:leanback:1.0.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
}
