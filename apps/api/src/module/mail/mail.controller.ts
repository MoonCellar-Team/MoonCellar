import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RolesEnum, type ISendTestLetterResponse } from "@mooncellar/schemas";
import { Roles } from "../roles/roles.decorator";
import { RolesGuard } from "../roles/roles.guard";
import { SendTestLetterDto } from "../../shared/zod/dto/mail.dto";
import { TEST_LETTER_SUBJECT, buildTestLetter } from "./mail.letter";
import { MailService } from "./mail.service";

@ApiTags("Mail")
@Controller("mail")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(RolesEnum.ADMIN)
@ApiCookieAuth()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post("test")
  @ApiOperation({ summary: "Send the test letter to one address" })
  @ApiResponse({
    status: 201,
    description: "The mail server accepted the letter",
  })
  @ApiResponse({ status: 503, description: "Mail is not configured" })
  async sendTest(
    @Body() { to }: SendTestLetterDto
  ): Promise<ISendTestLetterResponse> {
    await this.mailService.send({
      to,
      subject: TEST_LETTER_SUBJECT,
      letter: buildTestLetter(),
    });

    return { sent: true, to, subject: TEST_LETTER_SUBJECT };
  }
}
