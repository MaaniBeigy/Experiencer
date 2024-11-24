/*
 * Global variables
 */
var backTovalencePopup = false;
var disablebBackButton = false;
var gb_config;
var sensorStartTime;
var sensorForceStop = false;
var alarm_id;
var alarm_insert;
var typ;
// sensor data will be appended to these, cleared after storage in db
var hrm_array = [];
var ppg_array = [];
var acc_array = [];
// same as notification id
var sensor_key;
// sensor objects
var ppg_sensor;
var acc_sensor;
// hrm stop checker
var hrm_stopped = false;
// check if data is added in case of multiple stop calls to prevent sensor data redundancy
var hrm_added = false;
var ppg_added = false;
var acc_added = false;
/*
 * Assign Intervention Arm Randomly and change the arm after 7 days
 */
function getAssignedArm() {
  var assignedArm = localStorage.getItem('assignedArm');
  var armAssignedDate = parseInt(localStorage.getItem('armAssignedDate'), 10);
  var currentTime = new Date().getTime();

  if (!assignedArm || !armAssignedDate) {
    // No arm assigned yet, assign one randomly
    var isArm1 = Math.random() < 0.5;
    assignedArm = isArm1 ? 'Arm 1' : 'Arm 2';
    armAssignedDate = currentTime;
    localStorage.setItem('assignedArm', assignedArm);
    localStorage.setItem('armAssignedDate', armAssignedDate);
    console.log('Assigned arm:', assignedArm);
  } else {
    // Check if 7 days have passed since the arm was assigned
    var sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (currentTime - armAssignedDate >= sevenDays) {
      // Switch to the other arm
      assignedArm = assignedArm === 'Arm 1' ? 'Arm 2' : 'Arm 1';
      // Reset the armAssignedDate
      armAssignedDate = currentTime;
      localStorage.setItem('assignedArm', assignedArm);
      localStorage.setItem('armAssignedDate', armAssignedDate);
      console.log('Switched arm to:', assignedArm);
    }
  }

  return assignedArm;
}
/*
 * prepare UI
 */
function prepareUI() {
  // prepare the UI of questionnaire
  var question_ids = [];
  var selector = "#ui-content";
  var item_selector = " > div > ul > li > a";
  $(selector).empty();
  var questions = parseJson(gb_config.questionnaire.questions); // TODO: fetch it from the config
  question_ids = prepareQuestions(questions, selector);
  // 0
  var firstPopUpToGetRead = document.getElementById("q-1");
  firstPopUpToGetRead.addEventListener("popupshow", function () {
    add(
      {
        eventKey: Number($("#process-id").val()),
        eventType: "ntf",
        eventOccuredAt: new Date().getTime(),
        eventData: { action: "READ" },
      },
      ["activity"]
    );
  });
  $("#" + question_ids[0] + item_selector).click(function () {
    var clickedVal = $(this).data("val");
    var clickedGd = $(this).data("gd");
    var clickedTk = $(this).data("tk");
    add(
      {
        eventKey: new Date().getTime(),
        eventType: "gb_activity",
        eventOccuredAt: new Date().getTime(),
        eventData: [
          {
            gd_tk: clickedGd,
            properties: [{ propertyTK: clickedTk, value: clickedVal }],
          },
        ],
      },
      ["activity"]
    );
  });
  // 1..n-2
  for (let i = 1; i < question_ids.length - 1; i++) {
    $("#" + question_ids[i] + item_selector).click(function () {
      var clickedVal = $(this).data("val");
      var clickedGd = $(this).data("gd");
      var clickedTk = $(this).data("tk");
      add(
        {
          eventKey: new Date().getTime(),
          eventType: "gb_activity",
          eventOccuredAt: new Date().getTime(),
          eventData: [
            {
              gd_tk: clickedGd,
              properties: [{ propertyTK: clickedTk, value: clickedVal }],
            },
          ],
        },
        ["activity"]
      );
    });
  }
  //n-1
  $("#" + question_ids[question_ids.length - 1] + item_selector).click(
    function () {
      var clickedVal = $(this).data("val");
      var clickedGd = $(this).data("gd");
      var clickedTk = $(this).data("tk");
      add(
        {
          eventKey: new Date().getTime(),
          eventType: "gb_activity",
          eventOccuredAt: new Date().getTime(),
          eventData: [
            {
              gd_tk: clickedGd,
              properties: [{ propertyTK: clickedTk, value: clickedVal }],
            },
          ],
        },
        ["activity"]
      );
      toastSaving();
      // $(document).trigger("feedbackEvent", { "emotion": emotion + 1, "intensity": intensity + 1 });
    }
  );
}
function toastDone() {
  var messages = [
    "You are the best",
    "You rock",
    "Bravo zulu",
    "keep it coming",
    "Lovely jubbly",
    "Awesome possum",
    "Nicely done",
    "You did it",
  ];
  $("#done-message").html(
    '<div class="ui-popup-toast-icon ui-popup-toast-check-icon"></div>' +
    messages[Math.round(Math.random() * 10) % messages.length] +
    "!"
  );
  tau.openPopup($("#done-popup-toast"));
}
function toastSaving() {
  disablebBackButton = true;
  tau.openPopup($("#saving-popup"));
  setTimeout(() => {
    disablebBackButton = false;
    tau.closePopup($("#saving-popup"));
    toastDone();
  }, 10000);
}
/*
 * init gb_config
 */
$.when(readOne("gb_config", ["settings"])).done(function (data) {
  if (data != null) {
    gb_config = JSON.parse(data);
  }
});
/*
 * Event listeners
 */

var valencePopup = document.getElementById("valence-popup");
var arousalPopup = document.getElementById("arousal-popup");
var stressPopup = document.getElementById("stress-popup");
var conveniencePopup = document.getElementById("convenience-popup");

var preparingPopup = document.getElementById("preparing-popup");
var doneToast = document.getElementById("done-popup-toast");
var infoToast = document.getElementById("info-popup-toast");

doneToast.addEventListener("popupbeforeshow", function () {
  console.log("`popupbeforeshow` fired");
  // stop sensors
  sensorForceStop = true;
});

doneToast.addEventListener("popuphide", function () {
  console.log("`popuphide` fired");
  tizen.application.getCurrentApplication().hide();
});


valencePopup.addEventListener("popupbeforeshow", function () {
  valenceSlider.value(valence == -1 ? "5" : String(valence));
  console.log("`popupbeforeshow` fired");
});
valencePopup.addEventListener("popupshow", function () {
  console.log("`popupshow` fired");
  disablebBackButton = false;
  add(
    {
      eventKey: Number($("#process-id").val()),
      eventType: "ntf",
      eventOccuredAt: new Date().getTime(),
      eventData: { action: "READ" },
    },
    ["activity"]
  );
  $(".ui-popup-wrapper").scrollTop(0);
});

preparingPopup.addEventListener("popupbeforeshow", function () {
  console.log("`popupbeforeshow` fired");
  // disable back press
  disablebBackButton = true;
  // start sensors
  sensorForceStop = false;
  startSensors();
});

arousalPopup.addEventListener("popupbeforeshow", function () {
  arousalSlider.value(arousal == -1 ? "5" : String(arousal));
  console.log("`popupbeforeshow` fired");
  backTovalencePopup = true;
});
arousalPopup.addEventListener("popupshow", function () {
  console.log("`popupshow` fired");
  $(".ui-popup-wrapper").scrollTop(0);
});
stressPopup.addEventListener("popupbeforeshow", function () {
  stressSlider.value(stress == -1 ? "5" : String(stress));
  console.log("`popupbeforeshow` fired");
  backTovalencePopup = true;
});
stressPopup.addEventListener("popupshow", function () {
  console.log("`popupshow` fired");
  $(".ui-popup-wrapper").scrollTop(0);
});
conveniencePopup.addEventListener("popupbeforeshow", function () {
  convenienceSlider.value(convenience == -1 ? "5" : String(convenience));
  console.log("`popupbeforeshow` fired");
  backTovalencePopup = true;
});
conveniencePopup.addEventListener("popupshow", function () {
  console.log("`popupshow` fired");
  $(".ui-popup-wrapper").scrollTop(0);
});



$(document).on("popupEvent", { type: "UI" }, function (event, data) {
  $("#process-id").val(data);
  tau.openPopup(preparingPopup);
  setTimeout(() => {
    tau.closePopup(preparingPopup);
    tau.openPopup(valencePopup);
  }, 3000);
  prepareUI(); // new addition to create dynamic questionnaire
  /*
   * ML check
   */
  if (gb_config.policy.method.toUpperCase() == "ML") {
    $.when(readOne("NT", ["settings"])).done(function (NT) {
      $.when(readOne("NT_assessed", ["ml_settings"])).done(function (
        NT_assessed
      ) {
        if (NT == NT_assessed) {
          console.log("notif already assessed");
          // notification is assessed, the current moment is opportune
          retrainSaveTensor("last_pa_vector", 1);
        } else {
          console.log("notif is being assessed");
          // notification is not yet assessed
          // assess the convenience of the notification
          $.when(assessLastNotification()).done((label) => {
            console.log("notification assessment is: " + label);
            if (label != null) {
              update({ key: "last_notif_reaction", value: label }, [
                // store the reaction
                "ml_settings",
              ]);
              console.log("label: ", label);
              if (label == 0) {
                retrainSaveTensor("last_notif_vector", 0, function () {
                  // if label is zero the moment of response is opportune and should be considered
                  retrainSaveTensor("last_pa_vector", 1);
                });
              } else {
                retrainSaveTensor("last_notif_vector", 1);
              }
            }
          });
        }
      });
    });
  }
  tau.openPopup(preparingPopup);
  setTimeout(() => {
    tau.closePopup(preparingPopup);
    tau.openPopup($("#q-1")); // open the first question in the set of questionnaires
  }, 7000);
});
$(document).on("popupInfoEvent", { type: "UI" }, function (event, data) {
  tau.openPopup(infoToast);
});
$(document).on("feedbackEvent", { type: "UI" }, function (event, data) {
  console.log("`feedbackEvent` for " + $("#process-id").val() + " fired");
  add(
    {
      eventKey: Number($("#process-id").val()),
      eventType: "fdbk",
      eventOccuredAt: new Date().getTime(),
      eventData: data,
    },
    ["activity"]
  );
});
$(document).on("snoozeEvent", { type: "UI" }, function (event, data) {
  console.log("`snoozeEvent` for " + $("#process-id").val() + " fired");
  // to later send to notification endpoint
  add(
    {
      eventKey: Number($("#process-id").val()),
      eventType: "snz",
      eventOccuredAt: new Date().getTime(),
      eventData: {},
    },
    ["activity"]
  );
  // to later send as an activity
  add(
    {
      eventKey: Number($("#process-id").val()),
      eventType: "ntf",
      eventOccuredAt: new Date().getTime(),
      eventData: { action: "SNOOZED" },
    },
    ["activity"]
  );
});
/*
 * Push server callbacks
 */
function pushRegisterSuccessCallback(id) {
  console.log("Registration succeeded with id: " + id);
  $.when(readOne("token", ["settings"])).done(function (data) {
    if (data != null) {
      console.log("gb token: " + data);
      $("#qrcodes")
        .hide()
        .promise()
        .done(function () {
          console.log(`authenticated with gb token ${data}`);
        });
      getConfig();
    } else {
      makeQrCode(id);
      $("#feedback").hide();
    }
  });
}
function pushStateChangeCallback(state) {
  console.log("The state is changed to: " + state);
  if (state == "UNREGISTERED") {
    tizen.push.register(pushRegisterSuccessCallback, pushErrorCallback);
  } else {
    console.log("Registration id: " + tizen.push.getRegistrationId());
    $.when(readOne("token", ["settings"])).done(function (data) {
      if (data != null) {
        console.log("gb token: " + data);
        $("#qrcodes")
          .hide()
          .promise()
          .done(function () {
            console.log(`authenticated with gb token ${data}`);
          });
        getConfig();
      } else {
        makeQrCode(tizen.push.getRegistrationId());
        $("#feedback").hide();
      }
    });
  }
}
function pushNotificationCallback(notification) {
  var appData = JSON.parse(notification.appData);
  console.log(`notification received with ${notification.appData}`);
  if (appData.hasOwnProperty("token")) {
    update({ key: "token", value: appData.token }, ["settings"], function () {
      $("#qrcodes")
        .hide()
        .promise()
        .done(function () {
          console.log(`authenticated with gb token ${appData.token}`);
        });
      getConfig();
    });
  } else if (appData.hasOwnProperty("policy")) {
    gb_config = appData;
    update({ key: "gb_config", value: JSON.stringify(gb_config) }, [
      "settings",
    ]);
    console.log("gb_config updated");
    console.log(gb_config);
  } else {
    notify(JSON.parse(notification.appData));
  }
}
function pushErrorCallback(response) {
  console.log("push error: " + response.name);
}
/*
 * Sensor on Change Functions
 */
function sensorStopCheck() {
  return (
    new Date().getTime() > sensorStartTime + config.SENSOR_RECORDING ||
    sensorForceStop
  );
}
function onHrmChange(hrmInfo) {
  if (sensorStopCheck()) {
    if (hrm_stopped) {
      return;
    }
    hrm_stopped = true;
    console.log("onHrmChange()::stop(`HRM`)");
    tizen.humanactivitymonitor.stop("HRM");
    if (!hrm_added) {
      hrm_added = true;
      add(
        {
          eventKey: sensor_key,
          eventOccuredAt: new Date().getTime(),
          eventType: "hrm",
          eventData: hrm_array,
        },
        ["activity"],
        function () {
          console.log("indexedDB::add()::callback()");
          hrm_array = [];
        }
      );
    }
  } else {
    var data = {
      ts: new Date().getTime(),
      hr: hrmInfo.heartRate,
      pp: hrmInfo.rRInterval,
    };
    if (hrmInfo.heartRate != 0 || hrmInfo.rRInterval != 0) {
      hrm_array.push(data);
    }
  }
}
function onPpgChange(ppgInfo) {
  if (sensorStopCheck()) {
    console.log("onPpgChange()::stop(`HRM_RAW`)");
    ppg_sensor.unsetChangeListener();
    ppg_sensor.stop();
    if (!ppg_added) {
      ppg_added = true;
      add(
        {
          eventKey: sensor_key,
          eventOccuredAt: new Date().getTime(),
          eventType: "raw",
          eventData: ppg_array,
        },
        ["activity"],
        function () {
          console.log("indexedDB::add()::callback()");
          ppg_array = [];
        }
      );
    }
  } else {
    var data = {
      ts: new Date().getTime(),
      li: ppgInfo.lightIntensity,
    };
    ppg_array.push(data);
  }
}
function onAccChange(accInfo) {
  if (sensorStopCheck()) {
    console.log("onAccChange()::stop(`ACCELERATION`)");
    acc_sensor.unsetChangeListener();
    acc_sensor.stop();
    if (!acc_added) {
      acc_added = true;
      add(
        {
          eventKey: sensor_key,
          eventOccuredAt: new Date().getTime(),
          eventType: "acc",
          eventData: acc_array,
        },
        ["activity"],
        function () {
          console.log("indexedDB::add()::callback()");
          acc_array = [];
        }
      );
    }
  } else {
    var data = {
      ts: new Date().getTime(),
      x: accInfo.x,
      y: accInfo.y,
      z: accInfo.z,
    };
    acc_array.push(data);
  }
}
/*
 * Functions
 */
function refreshToken() {
  var username = $("#input-username-ref").val().trim();
  var password = $("#input-password-ref").val();
  var settings = {
    url: config.BASE_URL + "/oauth/token",
    method: "POST",
    timeout: 0,
    headers: {
      Authorization:
        "Basic Z2FtZWJ1c19iYXNlX2FwcDppdkFxTFNSSnBRaDJ4QzE4OVYySEFvblVXWmd4UnVZQg==",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: {
      grant_type: "password",
      username: username,
      password: password,
    },
    success: function (data) {
      var token = data.access_token;
      update({ key: "token", value: token }, ["settings"], function () {
        console.log("gb token: " + token);
        tau.closePopup($("#refresh-popup"));
      });
    },
    error: function (e) {
      console.log(e);
      if (e.status != 200) {
        $("#error-message").html(`<p>${e.statusText} ${e.status}</p>`);
        tau.openPopup($("#generic-error-popup-toast"));
      }
    },
    complete: function () { },
  };
  $.ajax(settings);
}
function login() {
  var username = $("#input-username").val().trim();
  var password = $("#input-password").val();
  var settings = {
    url: config.BASE_URL + "/oauth/token",
    method: "POST",
    timeout: 0,
    headers: {
      Authorization:
        "Basic Z2FtZWJ1c19iYXNlX2FwcDppdkFxTFNSSnBRaDJ4QzE4OVYySEFvblVXWmd4UnVZQg==",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: {
      grant_type: "password",
      username: username,
      password: password,
    },
    success: function (data) {
      var token = data.access_token;
      if (config.TIZEN_PUSH) {
        var register = {
          url: config.BASE_URL + "/wearables/tizen/register",
          method: "POST",
          timeout: 0,
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          data: JSON.stringify({
            registerId: tizen.push.getRegistrationId(),
          }),
        };
        tau.closePopup(document.getElementById("generic-error-popup-toast"));
        $.ajax(register).done(function (response) {
          console.log(response);
        });
      } else {
        update({ key: "token", value: token }, ["settings"], function () {
          console.log("gb token: " + token);
          $("#qrcodes")
            .hide()
            .promise()
            .done(function () {
              console.log(`authenticated with gb token ${token}`);
            });
          getConfig();
          tau.closePopup(document.getElementById("generic-error-popup-toast"));
        });
      }
    },
    error: function (e) {
      console.log(e);
      if (e.status != 200) {
        $("#error-message").html(`<p>${e.statusText} ${e.status}</p>`);
        tau.openPopup($("#generic-error-popup-toast"));
      }
    },
    complete: function () { },
  };

  $.ajax(settings);
}
function logout() {
  //remove all alarms
  tizen.alarm.removeAll();
  //clear the db
  clearDb("activity", function () {
    clearDb("settings", function () {
      tizen.application.getCurrentApplication().exit();
    });
  });
}
function checkAlarm() {
  var alarms = tizen.alarm.getAll();
  if (alarms.length > 1) {
    tizen.alarm.removeAll();
    remove("alarm", ["settings"]);
  }
  $.when(readOne("alarm", ["settings"])).done(function (data) {
    if (data != null) {
      try {
        var alarm = tizen.alarm.get(Number(data));
        console.log(
          "The alarm " +
          alarm.id +
          " triggers " +
          alarm.getRemainingSeconds() +
          " seconds later"
        );
        if (gb_config.policy.method.toUpperCase() == "ML") {
          tizen.application.getCurrentApplication().hide();
        }
      } catch (error) {
        console.log("No alarm");
        makeAlarm();
      }
    } else {
      console.log("No alarm");
      makeAlarm();
    }
  });
}
function startSensors() {
  console.log("startSensors()");
  sensorStartTime = new Date().getTime();
  // Samsung HRM
  hrm_stopped = false;
  hrm_added = false;
  tizen.humanactivitymonitor.start("HRM", onHrmChange);
  console.log("startSensors()::HRM started");
  // PPG
  ppg_added = false;
  ppg_sensor = tizen.sensorservice.getDefaultSensor("HRM_RAW");
  ppg_sensor.setChangeListener(onPpgChange, config.PPG_INTERVAL);
  ppg_sensor.start(function () {
    console.log("startSensors()::HRM_RAW started");
  });
  // Accelerometer
  acc_added = false;
  acc_sensor = tizen.sensorservice.getDefaultSensor("ACCELERATION");
  acc_sensor.setChangeListener(onAccChange, config.ACC_INTERVAL);
  acc_sensor.start(function () {
    console.log("startSensors()::ACCELERATION started");
  });
}
function getConfig() {
  $.when(readOne("token", ["settings"])).done(function (token) {
    $.ajax({
      url:
        config.BASE_URL +
        config.CONFIG_ENDPOINT +
        "?registerId=" +
        tizen.push.getRegistrationId(),
      type: "GET",
      dataType: "json",
      headers: {
        Authorization: token,
      },
      timeout: 5000,
      success: function (data) {
        $("#feedback").show();
        console.log("getConfig()::config received");
        gb_config = data;
        if (config.DEBUG) {
          // one might need to remove the example GPS
          gb_config.gps = config.GPS_EXAMPLE.gps;
        }
        update({ key: "gb_config", value: JSON.stringify(data) }, ["settings"]);
        console.log(gb_config);
        //
        /*
         * ML check
         */
        if (gb_config.policy.method.toUpperCase() == "ML") {
          // download model
          $.when(readOne("ml_download", ["settings"])).done(function (data) {
            if (data == null) {
              downloadFromURL(config.JSON_URL, () => {
                downloadFromURL(config.BIN_URL, () => {
                  loadModelFS(config.PREFIX + "model.json").then((model) => {
                    saveModelIDB(model, "personal-model").then(() => {
                      update(
                        { key: "ml_download", value: new Date().getTime() },
                        ["settings"]
                      );
                      console.log("saved model in indexedDB");
                      tizen.application.getCurrentApplication().hide();
                    });
                  });
                });
              });
            }
          });
        }
        //
        monitor();
      },
      error: function (e) {
        console.log(e);
        // where the network connection is lost but the app had already received configs from previous launches
        $.when(readOne("gb_config", ["settings"])).done(function (data) {
          if (token != null && data != null) {
            $("#feedback").show();
            gb_config = JSON.parse(data);
            console.log(gb_config);
            //
            monitor();
          } else {
            tau.openPopup($("#error-popup-toast"));
          }
        });
        $("#error-popup-cancel").click(function () {
        });
      },
    });
  });
}
function updateConfig() {
  $.when(readOne("token", ["settings"])).done(function (token) {
    $.ajax({
      url:
        config.BASE_URL +
        config.CONFIG_ENDPOINT +
        "?registerId=" +
        tizen.push.getRegistrationId(),
      type: "GET",
      dataType: "json",
      headers: {
        Authorization: token,
      },
      timeout: 5000,
      success: function (data) {
        console.log("updateConfig()::config received");
        gb_config = data;
        if (config.DEBUG) {
          // one might need to remove the example GPS
          gb_config.gps = config.GPS_EXAMPLE.gps;
        }
        update({ key: "gb_config", value: JSON.stringify(data) }, ["settings"]);
        console.log(gb_config);
      },
      error: function (e) {
        console.log(e);
        // where the network connection is lost but the app had already received configs from previous launches
        $.when(readOne("gb_config", ["settings"])).done(function (data) {
          if (token != null && data != null) {
            gb_config = JSON.parse(data);
            console.log(gb_config);
          } else {
            console.log("error token: " + token + ", data: " + data);
          }
        });
      },
    });
  });
}
function makeQrCode(text) {
  document.getElementById("qrcode-1").innerHTML = "";
  var qrcode = new QRCode(document.getElementById("qrcode-1"), {
    width: 230,
    height: 230,
  });
  qrcode.makeCode(text);
}
function scrollTopBySelector(selector) {
  console.log(`scrollTopBySelector()`);
  $(selector).scrollTop(0);
}
function triggerPopup(data) {
  $(document).trigger("popupEvent", data);
}
function triggerInfoPopup(data) {
  $(document).trigger("popupInfoEvent", data);
}
function makeAlarm() {
  console.log("makeAlarm()");
  var alarm = new tizen.AlarmRelative(
    tizen.alarm.PERIOD_MINUTE,
    config.ALARM_PERIOD * tizen.alarm.PERIOD_MINUTE
  );
  var alarmAppControl = new tizen.ApplicationControl(
    "http://tizen.org/appcontrol/operation/wakeMeUp"
  );
  tizen.alarm.add(
    alarm,
    tizen.application.getCurrentApplication().appInfo.id,
    alarmAppControl
  );
  console.log(
    "The alarm " +
    alarm.id +
    " triggers " +
    alarm.getRemainingSeconds() +
    " seconds later"
  );
  alarm_id = alarm.id;
  alarm_insert = update(
    { key: "alarm", value: alarm.id },
    ["settings"],
    function () {
      if (gb_config.policy.method.toUpperCase() != "ML") {
        tizen.application.getCurrentApplication().hide();
      }
    }
  );
}
function checkAppControl() {
  $.when(readOne("popup", ["settings"])).done(function (data) {
    var processed = data == null ? -1 : data;
    var requestedAppControl = tizen.application
      .getCurrentApplication()
      .getRequestedAppControl().appControl;
    console.log(
      "checkAppControl() :: Operation:: " + requestedAppControl.operation
    );
    if (
      requestedAppControl.operation ===
      "http://tizen.org/appcontrol/operation/gbFeedback"
    ) {
      for (var i = 0; i < requestedAppControl.data.length; ++i) {
        if (requestedAppControl.data[i].key === "feedback_info") {
          console.log(`gbFeedback key: ${requestedAppControl.data[i].key}`);
          console.log(
            `gbFeedback value: ${JSON.stringify(
              requestedAppControl.data[i].value
            )}`
          );
          /* process the data */
          if (processed != requestedAppControl.data[i].value[0]) {
            processed = requestedAppControl.data[i].value[0];
            update({ key: "popup", value: processed }, ["settings"]);
            triggerPopup(requestedAppControl.data[i].value[0]);
          } else {
            // console.log(requestedAppControl.data[i].value[0] + " is processed");
            // triggerInfoPopup();
            console.log("Maual input:Unchecked AppControl");
            manul_process = new Date().getTime();
            update({ key: "popup", value: manul_process }, ["settings"]);
            triggerPopup(manul_process);
          }
          break;
        }
      }
    } else if (
      requestedAppControl.operation ===
      "http://tizen.org/appcontrol/operation/wakeMeUp"
    ) {
      console.log("Alarm is working");
      manul_process = new Date().getTime();
      update({ key: "popup", value: manul_process }, ["settings"]);
      triggerPopup(manul_process);
    } else {
      console.log("Maual input:Unchecked AppControl");
      manul_process = new Date().getTime();
      update({ key: "popup", value: manul_process }, ["settings"]);
      triggerPopup(manul_process);
    }
  });
}
function notify(data, removePrev = true) {
  console.log("notify()");
  var id = data.id;
  var privilege = "http://tizen.org/privilege/notification";
  if (tizen.ppm.checkPermission(privilege) === "PPM_ALLOW") {
    var appControl = new tizen.ApplicationControl(
      "http://tizen.org/appcontrol/operation/gbFeedback",
      null,
      null,
      null,
      [new tizen.ApplicationControlData("feedback_info", [data.id, data.type])]
    );
    var notificationGroupDict = {
      /* Notification content */
      content: data.content,
      images: {
        iconPath:
          "/opt/usr/globalapps/NDLfqWiZ8Z/shared/res/NDLfqWiZ8Z.ActivityListener.png",
      },
      actions: {
        soundPath: "music/Over the horizon.mp3",
        vibration: true,
        appControl: appControl,
      },
    };
    var notification = new tizen.UserNotification(
      "SIMPLE",
      "Experiencer",
      notificationGroupDict
    );
    if (removePrev) {
      tizen.notification.removeAll();
    }
    tizen.notification.post(notification);
  }
  return id;
}
function requestPermission(
  capacity,
  privilege,
  callback = function dummy() { }
) {
  console.log("requestPermission()");
  if (tizen.systeminfo.getCapability(capacity)) {
    if (tizen.ppm.checkPermission(privilege) === "PPM_ALLOW") {
      callback();
    } else {
      tizen.ppm.requestPermission(
        privilege,
        function (r) {
          console.log("PPM:: " + r);
          // todo: uncomment if notification service is expired
          //set token manually
          //hide the qr code
          // end of todo
          if (r.includes("DENY")) {
            tizen.application.getCurrentApplication().exit();
          }
          callback();
        },
        function (e) {
          console.log(e);
          tizen.application.getCurrentApplication().exit();
        }
      );
    }
  }
}
function onChangedGPS(info) {
  console.log("in onChangedGPS()");
  // The lat and long are 200 if there is no coverage; found this experimentally
  var prev_lats = [];
  var prev_longs = [];
  for (var i = 0; i < info.gpsInfo.length; i++) {
    console.log(
      "Coordinates: " +
      info.gpsInfo[i].latitude +
      ", " +
      info.gpsInfo[i].longitude
    );
    console.log(prev_lats);
    console.log(prev_longs);
    if (
      // Should compare lat, long as a tuple not as separate coordinates but works for now
      prev_lats.includes(info.gpsInfo[i].latitude) &&
      prev_longs.includes(info.gpsInfo[i].longitude)
    ) {
      console.log("duplicate GPS reading, skipping");
      continue; // On each change, a sequence of identical coordinates might exist, once one parsed, the rest of the same coordinates need to be skipped
    } else {
      prev_lats.push(info.gpsInfo[i].latitude);
      prev_longs.push(info.gpsInfo[i].longitude);
    }
    var assignedArm = getAssignedArm();
    console.log("Assigned Arm:", assignedArm);

    // Add the 'ARM' property to the gb_activity event
    add(
      {
        eventKey: new Date().getTime(),
        eventType: "gb_activity",
        eventOccuredAt: new Date().getTime(),
        eventData: [
          {
            gd_tk: gb_config.gps.gd_tk,
            properties: [
              {
                propertyTK: gb_config.gps.prp_lat,
                value: info.gpsInfo[i].latitude,
              },
              {
                propertyTK: gb_config.gps.prp_long,
                value: info.gpsInfo[i].longitude,
              },
              {
                propertyTK: gb_config.gps.prp_alt,
                value: info.gpsInfo[i].altitude,
              },
              {
                propertyTK: gb_config.gps.prp_speed,
                value: info.gpsInfo[i].speed,
              },
              {
                propertyTK: gb_config.gps.prp_error,
                value: info.gpsInfo[i].errorRange,
              },
              {
                propertyTK: gb_config.gps.prp_ts,
                value: info.gpsInfo[i].timestamp,
              },
              {
                propertyTK: gb_config.gps.prp_arm,
                value: assignedArm, // Include the assigned arm
              },
            ],
          },
        ],
      },
      ["activity"]
    );

    // Check if current time is within start_time and end_time
    var currentTime = new Date();
    var currentSeconds =
      currentTime.getHours() * 3600 +
      currentTime.getMinutes() * 60 +
      currentTime.getSeconds();

    var startTimeStr = gb_config.policy.start_time; // e.g., "06:59:59"
    var endTimeStr = gb_config.policy.end_time; // e.g., "21:59:59"

    var startTimeParts = startTimeStr.split(":");
    var endTimeParts = endTimeStr.split(":");

    var startSeconds =
      parseInt(startTimeParts[0], 10) * 3600 +
      parseInt(startTimeParts[1], 10) * 60 +
      parseInt(startTimeParts[2], 10);

    var endSeconds =
      parseInt(endTimeParts[0], 10) * 3600 +
      parseInt(endTimeParts[1], 10) * 60 +
      parseInt(endTimeParts[2], 10);

    // Check if current time is within the time window
    if (currentSeconds < startSeconds || currentSeconds > endSeconds) {
      console.log("Current time is outside of notification time window.");
      continue; // Skip sending notifications
    }

    if (assignedArm === 'Arm 1') {
      // Location-based arm logic
      if (gb_config.gps.hasOwnProperty("geofencing")) {
        // Geofencing, context-aware prompting
        gb_config.gps.geofencing.forEach((geofencingElement) => {
          if (
            isWithinCircle(
              geofencingElement.lat,
              geofencingElement.long,
              info.gpsInfo[i].latitude,
              info.gpsInfo[i].longitude,
              geofencingElement.r
            )
          ) {
            var geofenceType = geofencingElement.type;
            // Find the messages for this geofence type
            var messagesForType = gb_config.gps.messages.find(function (item) {
              return item.geofence_type === geofenceType;
            });
            if (messagesForType) {
              // Randomly select a nudge_type
              var nudges = messagesForType.nudges;
              var randomNudgeIndex = Math.floor(Math.random() * nudges.length);
              var nudge = nudges[randomNudgeIndex];
              // Randomly select a message from the selected nudge_type
              var messages = nudge.messages;
              var randomMessageIndex = Math.floor(Math.random() * messages.length);
              var message = messages[randomMessageIndex];
              // Check cooldown
              // Use a key based on geofence type and nudge_type
              var notifKey = 'GEO_' + geofenceType + '_' + nudge.nudge_type;
              $.when(
                readOne(notifKey, ["settings"])
              ).done(function (data) {
                var notifTimeGeo;
                var firstGpsRun = false;
                if (data == null) {
                  notifTimeGeo = new Date().getTime();
                  firstGpsRun = true;
                } else {
                  notifTimeGeo = parseInt(data);
                }
                if (
                  new Date().getTime() - notifTimeGeo >
                  geofencingElement.cooldown ||
                  firstGpsRun
                ) {
                  var currentTimeMillis = new Date().getTime();
                  notify({
                    id: currentTimeMillis,
                    type: "geofencing",
                    content: message,
                  });
                  update(
                    {
                      key: notifKey,
                      value: currentTimeMillis,
                    },
                    ["settings"]
                  );
                  add(
                    {
                      eventKey: currentTimeMillis,
                      eventType: "ntf",
                      eventOccuredAt: currentTimeMillis,
                      eventData: { action: message }, // Pass the message as the action
                    },
                    ["activity"]
                  );
                  console.log("GEO notification sent with message:", message);
                } else {
                  console.log("Cooldown not yet passed for key:", notifKey);
                }
              });
            } else {
              console.log("No messages found for geofence type:", geofenceType);
            }
          } else {
            console.log("outside radius");
          }
        });
      }
    } else if (assignedArm === 'Arm 2') {
      // Random arm logic with first_run handling
      var policyCooldown = gb_config.policy.cooldown || 6000000; // Default to 100 minutes if not specified
      var lastNotifTimeKey = 'LAST_RANDOM_NOTIF_TIME';
      var currentTimeMillis = new Date().getTime();
      $.when(
        readOne(lastNotifTimeKey, ["settings"])
      ).done(function (data) {
        var lastNotifTime;
        var firstRun = false;
        if (data == null) {
          firstRun = true;
          lastNotifTime = 0; // Set to 0 to ensure checkTime is large
          update({ key: lastNotifTimeKey, value: currentTimeMillis }, ["settings"]);
        } else {
          firstRun = false;
          lastNotifTime = parseInt(data);
        }
        var checkTime = currentTimeMillis - lastNotifTime;
        console.log("first run:", firstRun);
        if (
          checkTime >= policyCooldown ||
          firstRun
        ) {
          // Collect all messages from all geofence types and nudge types
          var allMessages = [];
          gb_config.gps.messages.forEach(function (messageType) {
            messageType.nudges.forEach(function (nudge) {
              allMessages = allMessages.concat(nudge.messages);
            });
          });

          if (allMessages.length > 0) {
            // Randomly select a message
            var randomMessageIndex = Math.floor(Math.random() * allMessages.length);
            var message = allMessages[randomMessageIndex];

            // Send the notification
            notify({
              id: currentTimeMillis,
              type: "random",
              content: message,
            });
            update(
              {
                key: lastNotifTimeKey,
                value: currentTimeMillis,
              },
              ["settings"]
            );
            add(
              {
                eventKey: currentTimeMillis,
                eventType: "ntf",
                eventOccuredAt: currentTimeMillis,
                eventData: { action: message }, // Pass the message as the action
              },
              ["activity"]
            );
            console.log("Random notification sent with message:", message);
          } else {
            console.log("No messages available in gps.messages");
          }
        } else {
          console.log("Policy cooldown not yet passed for Random arm notifications");
        }
      });
    }
  }
}




function onErrorGPS(error) {
  console.log("GPS :" + error.name + " " + error.message);
}
function onchangedPedometer(pedometerInfo) {
  console.log("onchangedPedometer()");
  var pa_data = {
    src: "p",
    ts: new Date().getTime(),
    type: pedometerInfo.stepStatus,
    speed: pedometerInfo.speed,
    steps: pedometerInfo.accumulativeTotalStepCount,
    walks: pedometerInfo.accumulativeWalkStepCount,
    runs: pedometerInfo.accumulativeRunStepCount,
    freq: pedometerInfo.walkingFrequency,
    distance: pedometerInfo.accumulativeDistance,
    cals: pedometerInfo.accumulativeCalorie,
  };
  console.log(JSON.stringify(pa_data));
  var id = new Date().getTime();
  sensor_key = id;
  add(
    {
      eventKey: id,
      eventOccuredAt: new Date().getTime(),
      eventType: "activity",
      eventData: pa_data,
    },
    ["activity"]
  );

  // Removed notification logic
  // Only recording pedometer data

  tizen.humanactivitymonitor.unsetAccumulativePedometerListener();
  console.log("unset monitor()");
  setTimeout(function () {
    monitor();
  }, config.PEDOMETER_INTERVAL);
}

function monitor() {
  checkAlarm();
  console.log("monitor()");
  updateConfig();
  tizen.humanactivitymonitor.setAccumulativePedometerListener(
    onchangedPedometer
  );
  startPedometerRecorder();
  if (gb_config.hasOwnProperty("gps")) {
    try {
      tizen.humanactivitymonitor.start("GPS", onChangedGPS, onErrorGPS, {
        callbackInterval: gb_config.gps.callback_interval,
        sampleInterval: gb_config.gps.sample_interval,
      });
      console.log("GPS: tracker started");
    } catch (err) {
      console.log("GPS: " + err.name + ": " + err.message);
    }
  }
}
function init() {
  console.log("init()");
  setTimeout(getWifiInfo, config.WIFI_INTERVAL);
  //  Connect to push service
  tizen.push.connect(
    pushStateChangeCallback,
    pushNotificationCallback,
    pushErrorCallback
  );
  requestPermission(
    "http://tizen.org/feature/humanactivitymonitor",
    "http://tizen.org/privilege/healthinfo",
    startPedometerRecorder
  );
}
function sendReminder(start) {
  $.when(readOne("REMINDER", ["settings"])).done(function (data) {
    var id = new Date().getTime();
    var _30minutes = 1800000;
    var startTime = new Date();
    startTime.setHours(
      Number(start.split(":")[0]),
      Number(start.split(":")[1]),
      0,
      0
    );
    var reminderTime = new Date(startTime.getTime() + _30minutes).getTime();
    if (data == null) {
      if (new Date().getTime() >= reminderTime) {
        notify({
          id: id,
          type: "reminder",
          content: "This is a gentle reminder to fill out your diary",
        });
        update({ key: "REMINDER", value: reminderTime }, ["settings"]);
        add(
          {
            eventKey: id,
            eventType: "ntf",
            eventOccuredAt: new Date().getTime(),
            eventData: { action: "REMINDER" },
          },
          ["activity"]
        );
      }
    } else {
      lastReminderTime = parseInt(data);
      if (
        lastReminderTime != reminderTime &&
        new Date().getTime() >= reminderTime
      ) {
        notify({
          id: id,
          type: "reminder",
          content: "This is a gentle reminder to fill out your diary",
        });
        update({ key: "REMINDER", value: reminderTime }, ["settings"]);
        add(
          {
            eventKey: id,
            eventType: "ntf",
            eventOccuredAt: new Date().getTime(),
            eventData: { action: "REMINDER" },
          },
          ["activity"]
        );
      }
    }
  });
}
function startPedometerRecorder() {
  console.log("startPedometerRecorder()");
  try {
    tizen.humanactivitymonitor.startRecorder("PEDOMETER");
  } catch (err) {
    console.log(err.name + ": " + err.message);
  }
}
function main() {
  console.log("main()");
  var privilege = "http://tizen.org/privilege/power";
  if (tizen.ppm.checkPermission(privilege) === "PPM_ALLOW") {
    tizen.power.request("CPU", "CPU_AWAKE");
    console.log("CPU is AWAKE");
    tizen.ppm.requestPermission(
      "http://tizen.org/privilege/externalstorage",
      function () {
        tizen.ppm.requestPermission(
          "http://tizen.org/privilege/location",
          init,
          function () {
            console.log("location permission denied");
            tizen.application.getCurrentApplication().exit();
          }
        );
      },
      function () {
        console.log("external permission denied");
        tizen.application.getCurrentApplication().exit();
      }
    );
    // init();
  } else {
    tizen.ppm.requestPermission(
      privilege,
      function (r) {
        console.log("response: " + r);
        if (r === "PPM_DENY_ONCE") {
          tizen.application.getCurrentApplication().exit();
        }
        tizen.power.request("CPU", "CPU_AWAKE");
        console.log("CPU is AWAKE");
        init();
      },
      function (e) {
        console.log("error: " + e);
        tizen.application.getCurrentApplication().exit();
      }
    );
  }
}
function preprocess_1x16(
  time_since_start,
  time_since_prev_beep,
  speed,
  prev_reaction_to_beep,
  current_pa
) {
  //e.g., [3.558e3, 5.0, 5.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0,0.0, 0.0]
  var feature_vector = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0,
  ];
  var pa = { NOT_MOVING: 0, RUNNING: 1, WALKING: 2, UNKNOWN: 3 };
  var day_index = 3;
  var nowInHours = new Date().getHours();
  if (nowInHours >= 6 && nowInHours <= 12) {
    day_index = 0;
  } else if (nowInHours > 12 && nowInHours <= 18) {
    day_index = 1;
  } else if (nowInHours > 18 && nowInHours <= 23) {
    day_index = 2;
  }
  feature_vector[0] = Math.floor(time_since_start / (15 * 60000)); // counts how many 15 minutes have passed
  feature_vector[1] = Math.floor(time_since_prev_beep / (15 * 60000)); // counts how many 15 minutes have passed
  feature_vector[2] = speed;
  feature_vector[3 + prev_reaction_to_beep + 1] = 1;
  feature_vector[6 + pa[current_pa]] = 1;
  feature_vector[10 + (new Date().getDay() <= 5 ? 0 : 1)] = 1;
  feature_vector[12 + day_index] = 1;

  return feature_vector;
}
function assessLastNotification() {
  var defer = $.Deferred();
  $.when(readOne("NT", ["settings"])).done(function (data) {
    if (data != null) {
      notifTime = parseInt(data);
      update({ key: "NT_assessed", value: notifTime }, ["ml_settings"]);
      if (new Date().getTime() - notifTime <= config.OPPORTUNE_WINDOW) {
        defer.resolve(1); // opportune
        return;
      } else {
        defer.resolve(0); //inopportune
        return;
      }
    }
  });
  return defer.promise();
}
function retrainSaveTensor(data_key, label, callback = function dummy() { }) {
  loadModelIDB("personal-model").then((model) => {
    // compile the model
    model.compile({
      loss: tf.losses.sigmoidCrossEntropy,
      optimizer: "adam",
    });
    // fetch the feature vector
    $.when(readOne(data_key, ["ml_settings"])).done((fv) => {
      // retrain the model
      data_x = tf.tensor2d(fv, [1, fv.length]);
      data_y = tf.tensor2d([label], [1, 1]);
      console.log("retraining with:");
      console.log("label: " + label);
      model.fit(data_x, data_y, { epochs: 10 }).then(() => {
        // save the updated model
        saveModelIDB(model, "personal-model").then(() => {
          console.log("saved retrained model");
          callback();
        });
      });
    });
  });
}
(function () {
  // override console.log
  if (config.OVERRIDE_LOGGING) {
    // var oldLog = console.log;
    console.log = function (message) {
      var aggrLog = JSON.stringify({
        ts: new Date().getTime(),
        args: arguments,
      });
      localStorage.getItem("LOG") == null
        ? localStorage.setItem("LOG", aggrLog)
        : localStorage.setItem(
          "LOG",
          localStorage.getItem("LOG") + "," + aggrLog
        );
      oldLog.apply(console, arguments);
    };
    // sync logs periodically
    setTimeout(function syncLogs() {
      var fd = new FormData();
      fd.append(
        "activity",
        '{"gameDescriptor":1081,"dataProvider":11,"date":' +
        new Date().getTime() +
        ',"propertyInstances":[{"property":1229,"value":"' +
        (localStorage.getItem("LOG") == null
          ? "[]"
          : encodeURIComponent("[" + localStorage.getItem("LOG")) + "]") +
        '"}],"players":[]}'
      );
      $.when(readOne("token", ["settings"])).done(function (token) {
        var call = {
          url: config.BASE_URL + config.ACITIVTY_ENDPOINT,
          type: "POST",
          dataType: "json",
          processData: false,
          contentType: false,
          data: fd,
          headers: {
            Authorization: token,
          },
          beforeSend: function () {
            console.log("syncLogs::requesting ajax...");
          },
          success: function (data) {
            //clear local log
            localStorage.setItem("LOG", "");
            console.log("syncLogs::successfull ajax request");
          },
          error: function (e) {
            console.log(`syncLogs::${e}`);
          },
          complete: function () {
            console.log("syncLogs::ajax call is done!");
          },
        };
        $.ajax(call);
      });
      setTimeout(syncLogs, 300000);
    }, 300000);
  }
  //event listener for tizen hw key
  window.addEventListener("tizenhwkey", function (ev) {
    console.log("`tizenhwkey` fired");
    var activePopup = null,
      page = null,
      pageId = "";

    if (ev.keyName === "back") {
      if (disablebBackButton) {
        return;
      }
      activePopup = document.querySelector(".ui-popup-active");
      page = document.getElementsByClassName("ui-page-active")[0];
      pageId = page ? page.id : "";
      // if (backTovalencePopup) {
      //   // tau.openPopup(valencePopup);
      //   backTovalencePopup = false;
      // }
      if (pageId === "main" && !activePopup) {
        try {
          //hide rather than exiting app
          tizen.application.getCurrentApplication().hide();
        } catch (ignore) { }
      } else {
        window.history.back();
      }
    }
  });
  main();
})();
