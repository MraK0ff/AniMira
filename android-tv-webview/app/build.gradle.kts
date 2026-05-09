plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.animira.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.animira.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"

        buildConfigField("String", "UPDATE_SERVER_URL", "\"http://192.168.2.7:8000\"")
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

        // Копируем только APK в целевую папку после сборки
        variant.packageApplicationProvider.get().doLast {
            val apkFile = File(outputDir.get().asFile, "app-debug.apk")
            val targetDir = File(rootDir.parentFile, "apk")
            targetDir.mkdirs()
            apkFile.copyTo(File(targetDir, "app-debug.apk"), overwrite = true)
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
