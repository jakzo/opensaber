## Dev

Start the dev server with:

```sh
yarn workspace @opensaber/game dev
```

### Quest setup

1. Install ADB command line tool, enable developer mode on Quest and authorize your computer
   - [Instructions from Oculus](https://developer.oculus.com/documentation/native/android/mobile-device-setup/)
   - Verify that your computer can see the Quest with: `adb devices`
1. _[optional]_ Set up wireless ADB
   - Run while Quest is plugged in via USB: `adb tcpip 5555`
   - Disconnect Quest then run: `adb connect 192.168.1.108` (replace IP with your Quest's IP)
1. Forward localhost to the PC
   - This is required because WebXR only works from localhost or HTTPS.
   - Forward dev server HTTP: `adb reverse tcp:8080 tcp:8080`
   - Forward dev server WebSocket: `adb reverse tcp:11123 tcp:11123`
1. Open http://localhost:8080 in the Quest's browser
1. Open Chrome dev tools for the Quest
   - On your computer open [chrome://inspect/#devices](chrome://inspect/#devices) and inspect the tab on the Quest
