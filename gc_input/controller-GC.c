/* controller-GC.c - Gamecube controller input module
   by Mike Slegeir for Mupen64-GC
 */

#include <ogc/pad.h>
#include "controller.h"

static int controller_GC_GetKeys(int Control, BUTTONS * Keys )
{
	BUTTONS* c = Keys;
		
	int b = PAD_ButtonsHeld(Control);
	c->R_DPAD       = (b & PAD_BUTTON_RIGHT) ? 1 : 0;
	c->L_DPAD       = (b & PAD_BUTTON_LEFT)  ? 1 : 0;
	c->D_DPAD       = (b & PAD_BUTTON_DOWN)  ? 1 : 0;
	c->U_DPAD       = (b & PAD_BUTTON_UP)    ? 1 : 0;
	c->START_BUTTON = (b & PAD_BUTTON_START) ? 1 : 0;
	c->B_BUTTON     = (b & PAD_BUTTON_B)     ? 1 : 0;
	c->A_BUTTON     = (b & PAD_BUTTON_A)     ? 1 : 0;

	c->Z_TRIG       = (b & PAD_TRIGGER_Z)    ? 1 : 0;
	c->R_TRIG       = (b & PAD_TRIGGER_R)    ? 1 : 0;
	c->L_TRIG       = (b & PAD_TRIGGER_L)    ? 1 : 0;

	// FIXME: Proper values for analog and C-Stick
	s8 substickX = PAD_SubStickX(Control);
	c->R_CBUTTON    = (substickX >  5)       ? 1 : 0;
	c->L_CBUTTON    = (substickX < -5)       ? 1 : 0;
	s8 substickY = PAD_SubStickY(Control);
	c->D_CBUTTON    = (substickY < -5)       ? 1 : 0;
	c->U_CBUTTON    = (substickY >  5)       ? 1 : 0;
	
	c->X_AXIS       = PAD_StickX(Control);
	c->Y_AXIS       = PAD_StickY(Control);
	
	// X+Y quits to menu
	return (b & PAD_BUTTON_X) && (b & PAD_BUTTON_Y);
}

static void controller_GC_pause(int Control){
	PAD_ControlMotor(Control, PAD_MOTOR_STOP);
}

static void controller_GC_resume(int Control){ }

static void controller_GC_rumble(int Control, int rumble){
	if(rumble) PAD_ControlMotor(Control, PAD_MOTOR_RUMBLE);
	else PAD_ControlMotor(Control, PAD_MOTOR_STOP);
}

static void controller_GC_configure(int Control){
	// Don't know how this should be integrated
}

static void controller_GC_init(void);

controller_t controller_GC =
	{ controller_GC_GetKeys,
	  controller_GC_configure,
	  controller_GC_init,
	  controller_GC_pause,
	  controller_GC_resume,
	  controller_GC_rumble,
	  {0, 0, 0, 0}
	 };

static void controller_GC_init(void){
	PAD_Init();
	
	PADStatus status[4];
	PAD_Read(status);
	int i;
	for(i=0; i<4; ++i)
		controller_GC.available[i] = status[i].err != PAD_ERR_NO_CONTROLLER;
}