# ProGuard rules for Anistar TV

# Keep the entry points
-keep public class com.anistar.tv.MainActivity {
    public <init>();
}

# Keep settings classes
-keep class com.anistar.tv.SettingsActivity { *; }
-keep class com.anistar.tv.SettingsManager { *; }

# WebView
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}
